import Mailgun from 'mailgun.js'
import formData from 'form-data'
import * as dotenv from 'dotenv'
import path from 'path'
import { checkEmailExists, verificationMsg } from '../../utils/emailUtils'
import { ReturnValue, Status } from '../../utils/retVal'
import { UserSchema } from '../../schemas/User'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { generateObjectId } from '../../utils/cryptoUtils'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

dotenv.config({ path: path.join(__dirname, '../../.env') })

const mailgun = new Mailgun(formData)
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_KEY ?? '',
  url: 'https://api.eu.mailgun.net',
})

/**
 * `registerAccount` registers a user's account on our Webapp and stores the data in the database.
 * This is done if users register their account via email or links their account to an email.
 * @param email the user's email
 * @param password the user's password
 */
export const registerAccount = async (email: string, password: string): Promise<ReturnValue> => {
  try {
    const User = mongoose.model('_User', UserSchema, '_User')

    // check whether email already exists in the database
    // if it does, return an error
    // if it doesn't, continue.
    const emailExists = await checkEmailExists(email)
    if (emailExists) {

      return {
        status: Status.ERROR,
        message: 'Email already exists',
        data: null
      }
    }

    // password requirements
    if (password.length < 8 || // Minimum length
        !/[a-z]/.test(password) || // Lowercase letter
        !/[A-Z]/.test(password) || // Uppercase letter
        !/[0-9]/.test(password) || // Number
        !/[!@#$%^&*]/.test(password) // Special symbol
        // password.includes('commonword') || // Avoid common words
        // password.includes(email.split('@')[0])) // Avoid part of email
      ) {
      return {
        status: Status.ERROR,
        message: 'Password does not meet requirements.',
        data: null
      };
    }

    // hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // create a verification data object to be stored for this user.
    const verificationData = {
      // the verification token
      verificationToken: crypto.randomBytes(150).toString('hex'),
      // 24 hour validity
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }

    // create a new user doc
    const newUser = new User({
      _id: generateObjectId(),
      email: email,
      _hashed_password: hashedPassword,
      _created_at: Date.now(),
      _updated_at: Date.now(),
      // since the user hasn't technically verified their email, set this to false.
      hasVerified: false,
      verificationData: verificationData,
      uniqueHash: crypto.randomBytes(64).toString('hex')
    })

    // save the user to the database
    await newUser.save()

    // send the verification email to the user
    await sendVerificationEmail(email, `https://webapp.nbcompany.io/signup/verify?email=${email}&token=${verificationData.verificationToken}&changedEmail=false`)

    return {
      status: Status.SUCCESS,
      message: 'Account created successfully',
      data: {
        email: email,
        verificationToken: verificationData.verificationToken
      }
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `changeEmail` changes the user's previous email to a new one (will be unverified until user verifies)
 * @param email the user's current email
 * @param password the user's password
 * @param newEmail the user's new email to be changed to
 * @returns a ReturnValue instance
 */
export const changeEmail = async (email: string, password: string, newEmail: string): Promise<ReturnValue> => {
  try {
    if (!newEmail) {
      return {
        status: Status.ERROR,
        message: 'New email is required',
        data: null
      }
    }

    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User not found',
        data: null
      }
    }

    if (!userQuery.hasVerified) {
      return {
        status: Status.ERROR,
        message: 'You are required to verify your current email first before changing.',
        data: null
      }
    }

    const newEmailQuery = await User.findOne({ email: newEmail })
    if (newEmailQuery) {
      return {
        status: Status.ERROR,
        message: 'This email is already used. Please change to another email.',
        data: null
      }
    }

    if (userQuery.emailChangeData?.newEmailUnverified) {
      return {
        status: Status.ERROR,
        message: 'You have already requested to change your email. Please verify your new email first before changing.',
        data: null
      }
    }

    // apparently, when hashes start with '$2y', they need to be replaced to '$2a'.
    const passwordMatch = await bcrypt.compare(password, userQuery._hashed_password.replace(/^\$2y/, '$2a') ?? '')
    if (!passwordMatch) {
      return {
        status: Status.ERROR,
        message: 'Unauthorized to change email. False password.',
        data: null
      }
    }

    // if the user has an existing `emailChangeData` object
    if (userQuery.emailChangeData) {
      const changeDate = userQuery.emailChangeData.changeDate
      const now = Date.now()
      const diff = now - changeDate
      // if the user has just recently changed their email (within 7 days), we return an error.
      if (userQuery.emailChangeData.changeDate && userQuery.emailChangeData.changeDate > Date.now() - 7 * 24 * 60 * 60 * 1000) {
        return {
          status: Status.ERROR,
          message: `You have recently changed your email ${Math.floor(diff / 1000 / 60 / 60 / 24)} day(s) ago. You can only change your email once every 7 days.`,
          data: null
        }
      }
    }

    // if the user has changed their email more than 7 days ago OR they don't have an existing `emailChangeData` (meaning they never changed emails before), we continue.
    // we will first set `emailChangeData.prevEmail` to be `email`
    // `emailChangeData.newEmailUnverified` will be `newEmail`
    // `emailChangeData.newEmailVerified` will be null
    // then, we call `createVerificationTokenEmailChange` to create a verification token for the new email.
    await User.updateOne({ email: email }, { $set: { 'emailChangeData.prevEmail': email, 'emailChangeData.newEmailUnverified': newEmail, 'emailChangeData.newEmailVerified': null } })

    // call `createVerificationTokenEmailChange` to create a verification token for the new email.
    await createVerificationTokenEmailChange(email, newEmail)

    return {
      status: Status.SUCCESS,
      message: 'Email change request successful. An email has been sent to the user.',
      data: null
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `changePassword` changes the user's password.
 * Future implementations will include being able to change password if users forget their password.
 * @param email the user's email
 * @param password the user's password
 */
export const changePassword = async (email: string, password: string, newPassword: string): Promise<ReturnValue> => {
  try {
    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User not found',
        data: null
      }
    }

    // apparently, when hashes start with '$2y', they need to be replaced to '$2a'.
    const passwordMatch = await bcrypt.compare(password, userQuery._hashed_password.replace(/^\$2y/, '$2a') ?? '')
    if (!passwordMatch) {
      return {
        status: Status.ERROR,
        message: 'Unauthorized to change password. False password.',
        data: null
      }
    }

    // password requirements
    if (password.length < 8 || // Minimum length
        !/[a-z]/.test(password) || // Lowercase letter
        !/[A-Z]/.test(password) || // Uppercase letter
        !/[0-9]/.test(password) || // Number
        !/[!@#$%^&*]/.test(password) // Special symbol
        // password.includes('commonword') || // Avoid common words
        // password.includes(email.split('@')[0])) // Avoid part of email
      ) {
      return {
        status: Status.ERROR,
        message: 'Password does not meet requirements.',
        data: null
      };
    }

    // hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // set the user's hashed password to be the new hashed password
    await userQuery.updateOne({ $set: { _hashed_password: hashedPassword } })

    return {
      status: Status.SUCCESS,
      message: 'Password changed successfully',
      data: null
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `linkWallet` links a wallet to a user's account.
 * 
 * the account MUST not have a wallet address connected to their account yet.
 * @param email the user's email
 * @param wallet the user's wallet
 * @param password the user's password
 * @param uniqueHash the user's unique hash
 * @returns 
 */
export const linkWallet = async (email: string, wallet: string, password?: string, uniqueHash?: string): Promise<ReturnValue> => {
  try {
    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    if (!password && !uniqueHash) {
      return {
        status: Status.ERROR,
        message: 'Unauthorized to link wallet. Requires at least a password or uniqueHash',
        data: null
      }
    }

    if (password) {
      // apparently, when hashes start with '$2y', they need to be replaced to '$2a'.
      const passwordMatch = await bcrypt.compare(password, userQuery._hashed_password.replace(/^\$2y/, '$2a') ?? '')
      if (!passwordMatch) {
        return {
          status: Status.ERROR,
          message: 'Unauthorized to link wallet. False password.',
          data: null
        }
      }
    }

     // check for the unique hash and if it matches
     if (uniqueHash && userQuery.uniqueHash !== uniqueHash) {
      return {
        status: Status.ERROR,
        message: 'Unique hash does not match',
        data: null
      }
    }

    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User not found',
        data: null
      }
    }

    if (!userQuery.hasVerified) {
      return {
        status: Status.ERROR,
        message: 'User has not verified their email yet',
        data: null
      }
    }

    if (userQuery.ethAddress || userQuery.accounts.length > 0) {
      return {
        status: Status.ERROR,
        message: 'User already has a wallet connected to their account',
        data: null
      }
    }

    // check if the wallet is already linked to another account
    const walletQuery = await User.findOne({ ethAddress: wallet })
    if (walletQuery) {
      return {
        status: Status.ERROR,
        message: 'Wallet is already linked to another account',
        data: null
      }
    }

    // if all checks pass, we add the wallet to the user's account
    // we update ethAddress and accounts[0]
    await User.updateOne({ email: email }, { $set: { ethAddress: wallet, accounts: [wallet] } })

    return {
      status: Status.SUCCESS,
      message: 'Wallet linked successfully',
      data: null
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `checkNewEmailUnverified` checks whether a user's email to be changed to is still unverified.
 * This is done if the user has requested to change their email but has not verified their new email yet.
 * this check makes sense because once a new email is verified, that becomes their current `email` and the `newEmailUnverified` becomes null.
 * @param email the user's current email
 */
export const checkNewEmailUnverified = async (email: string): Promise<ReturnValue> => {
  try {
    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User not found',
        data: null
      }
    }

    if (!userQuery.emailChangeData) {
      return {
        status: Status.ERROR,
        message: 'User has not requested to change their email',
        data: null
      }
    }

    if (!userQuery.emailChangeData.newEmailUnverified) {
      return {
        status: Status.SUCCESS,
        message: 'User has already verified their new email',
        data: {
          verified: true,
        }
      }
    } else {
      return {
        status: Status.SUCCESS,
        message: 'User has not verified their new email yet',
        data: {
          verified: false,
        }
      }
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `createVerificationToken` manually creates a verification token for non-verified emails
 * 
 * requires a JWT token, password OR the user's unique hash to ensure that only authorized users can create a verification token for a user's email.
 * 
 * this should only be called for emails that have been registered before Aug 25 2023 (when we updated the account registration to include verification tokens)
 * 
 * 
 * all emails prior to aug 25 will not have a verification token and is required to have one, hence this function.
 * 
 * this function includes checks and ensures that the verification token won't be sent if any of the checks fail.
 * @param email the user's email
 * @returns a ReturnValue instance
 */
export const createVerificationToken = async (email: string, password?: string, jwtToken?: string, uniqueHash?: string): Promise<ReturnValue> => {
  try {
    if (!password && !jwtToken && !uniqueHash) {
      return {
        status: Status.ERROR,
        message: 'Unauthorized to send verification email. Requires at least a password or jwtToken or uniqueHash',
        data: null
      }
    }

    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    // if user isn't found, then we return an error
    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User not found',
        data: null
      }
    }

    // if the user has already verified their email, we return an error
    if (userQuery.hasVerified) {
      return {
        status: Status.ERROR,
        message: 'User has already verified their email',
        data: null
      }
    }

    // if the user has a verification token, we return an error
    if (userQuery.verificationData) {
      return {
        status: Status.ERROR,
        message: 'User already has a verification token',
        data: null
      }
    }

    // if password exists, then we go with the password route.
    if (password) {
      // apparently, when hashes start with '$2y', they need to be replaced to '$2a'.
      const passwordMatch = await bcrypt.compare(password, userQuery._hashed_password.replace(/^\$2y/, '$2a') ?? '')
      if (!passwordMatch) {
        return {
          status: Status.ERROR,
          message: 'Unauthorized to send verification email. False password.',
          data: null
        }
      }
    } else if (jwtToken) {
      // if the user has no verification token, first check if the JWT token provided is valid
      const decodedToken = verifyJwtToken(jwtToken)

      // if the JWT token is invalid, we return an error
      if (!decodedToken) {
        return {
          status: Status.ERROR,
          message: 'Unauthorized to send verification email. False JWT token.',
          data: null
        }
      }
    } else if (uniqueHash) {
      // get the uniqueHash
      const uniqueHashToCheck = userQuery.uniqueHash
      if (!uniqueHashToCheck) {
        return {
          status: Status.ERROR,
          message: 'An error has occurred when trying to fetch the user\'s unique hash. Please try again later.',
          data: null,
        }
      }

      // check if the given unique hash matches the `uniqueHashToCheck`
      if (uniqueHash !== uniqueHashToCheck) {
        return {
          status: Status.ERROR,
          message: 'Unauthorized to send verification email. False unique hash.',
          data: null
        }
      }
    }

    // if either password/jwt token/unique hash is valid, we create the verification data and save it to the database
    const verificationData = {
      // the verification token
      verificationToken: crypto.randomBytes(150).toString('hex'),
      // 24 hour validity
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }

    // add the verification token to the user's doc
    await User.updateOne({ email: email }, { $set: { verificationData: verificationData } })

    // send the verification email to the user
    await sendVerificationEmail(email, `https://webapp.nbcompany.io/signup/verify?email=${email}&token=${verificationData.verificationToken}`)

    return {
      status: Status.SUCCESS,
      message: 'Verification token created successfully. An email has been sent to the user.',
      data: null,
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `createVerificationTokenEmailChange` creates a verification token for a user who has requested to change their email.
 * @param prevEmail the user's `current email`, technically
 * @param email the user's new email to be verified
 * 
 * this is a 'private' function that will be called by `changeEmail` 
 * @returns a ReturnValue instance
 */
const createVerificationTokenEmailChange = async (prevEmail: string, email: string): Promise<ReturnValue> => {
  try {
    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: prevEmail })

    // this shouldnt return an error since the parent function should check for this already
    // but just as a precaution
    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User not found',
        data: null
      }
    }

    // password checks have been done in the parent function. now, we just create the verification token and send the email.
    const verificationData = {
      // the verification token
      verificationToken: crypto.randomBytes(150).toString('hex'),
      // 24 hour validity
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }

    // add the verification token to the user's doc
    await User.updateOne({ email: prevEmail }, { $set: { 'emailChangeData.changeVerificationData': verificationData } })

    // send the verification email to the user
    await sendVerificationEmail(email, `https://webapp.nbcompany.io/signup/verify?email=${email}&token=${verificationData.verificationToken}&changedEmail=true&prevEmail=${prevEmail}`)

    return {
      status: Status.SUCCESS,
      message: 'Verification token created successfully. An email has been sent to the user.',
      data: null,
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `verifyJwtToken` verifies whether the JWT token specified is valid.
 * @param token the JWT token to verify
 * @returns a string if the token is valid, null if the token is invalid
 */
export const verifyJwtToken = (token: string): string | jwt.JwtPayload => {
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET ?? '')

    // if valid, return decodedToken
    return decodedToken
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return null
  }
}

/**
 * `sendVerificationEmail` sends a verification email to the user's email.
 * @param email the user's email to send the verification email to
 * @param verificationLink the link that will be sent to the user's email for verification
 * @returns a ReturnValue instance
 */
export const sendVerificationEmail = async (email: string, verificationLink: string): Promise<ReturnValue> => {
  try {
    const sendEmail = mg.messages
      .create('nbcompany.io', verificationMsg(email, verificationLink))

    return {
      status: Status.SUCCESS,
      message: 'Verification email sent: ' + sendEmail,
      data: null
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `verifyToken` verifies whether the token sent to the user to verify their email is valid.
 * If it is, the user's account will be verified.
 * If it isn't, the user's account will not be verified and an error will be returned.
 * @param email the user's email
 * @param token the verification token to be checked
 * @returns a ReturnValue instance
 */
export const verifyToken = async (email: string, token: string): Promise<ReturnValue> => {
  try {
    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    // if the user doesn't exist, return an error
    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User does not exist',
        data: null
      }
    }

    // if the user has already verified their email, return an error
    if (userQuery.hasVerified) {
      return {
        status: Status.ERROR,
        message: 'User has already verified their email',
        data: null
      }
    }

    // if the token in the DB doesn't match the token sent, return an error
    if (userQuery.verificationData.verificationToken !== token) {
      return {
        status: Status.ERROR,
        message: 'Invalid token',
        data: null
      }
    }

    // if the token has expired, return an error
    if (userQuery.verificationData.expiryDate < Date.now()) {
      return {
        status: Status.ERROR,
        message: 'Token has expired',
        data: null
      }
    }

    // if all checks pass, set the user's account to verified
    userQuery.hasVerified = true

    // save the changes
    await userQuery.save()

    return {
      status: Status.SUCCESS,
      message: 'User verified successfully',
      data: null
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `verifyTokenEmailChange` verifies whether the token sent to the user to verify their newly changed email is valid.
 * @param prevEmail the user's previous email (to be replaced with `newEmail` at the end if all checks pass)
 * @param newEmail the user's new email
 * @param token the verification token to be checked
 * @returns a ReturnValue instance
 */
export const verifyTokenEmailChange = async (prevEmail: string, newEmail: string, token: string): Promise<ReturnValue> => {
  try {
    console.log('prevEmail: ', prevEmail)
    console.log('newEmail: ', newEmail)
    console.log('token: ', token)

    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: prevEmail })

    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User does not exist',
        data: null
      }
    }

    // if the token in the DB doesn't match the token sent, return an error
    if (userQuery.emailChangeData.changeVerificationData.verificationToken !== token) {
      return {
        status: Status.ERROR,
        message: 'Invalid token',
        data: null
      }
    }

    // if the token has expired, return an error
    if (userQuery.emailChangeData.changeVerificationData.expiryDate < Date.now()) {
      return {
        status: Status.ERROR,
        message: 'Token has expired',
        data: null
      }
    }

    // if all checks pass, we set the user's `emailChangeData.newEmailVerified` to be `newEmail`.
    // `emailChangeData.newEmailUnverified` will be null.
    // `emailChangeData.changeVerificationData` will be null.
    // `emailChangeData.changeDate` will be the current date.
    await User.updateOne({ email: prevEmail }, { $set: { 'emailChangeData.newEmailVerified': newEmail, 'emailChangeData.newEmailUnverified': null, 'emailChangeData.changeVerificationData': null, 'emailChangeData.changeDate': Date.now() } })
    // we also set the user's `email` to be `newEmail` if all checks pass.
    await User.updateOne({ email: prevEmail }, { $set: { email: newEmail } })

    return {
      status: Status.SUCCESS,
      message: 'New email has been verified successfully',
      data: null
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `emailLogin` logs the user in via email and password.
 * @param email the user's email
 * @param password the user's password
 * @returns a ReturnValue instance
 */
export const emailLogin = async (email: string, password: string): Promise<ReturnValue> => {
  try {
    await mongoose.connect(process.env.MONGODB_URI ?? '')
    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    // if user does not exist, we return an error (also including that 'password is incorrect' for anonymity)
    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'Email does not exist or password is incorrect. Please try again.',
        data: null
      }
    }

    // if a user has not verified their token but doesn't have a verification token yet, that means that their account is created before aug 25.
    // we send them a verification email here.
    if (!userQuery.hasVerified && !userQuery.verificationData) {
      // if all checks pass, create a token and send the verification email
      // at this point, once the email is sent, this block shouldnt be passed through again since `verificationData` will exist.
      // it will therefore move forward to the next block check.
      const createToken = await createVerificationToken(email, password)
      console.log(createToken)
      return {
        status: Status.ERROR,
        message: `You have not verified your email. We've just sent you a verification email. Please check your inbox.`,
        data: null
      }
    }

    // if a user has not verified their email, we return an error
    if (!userQuery.hasVerified) {
      return {
        status: Status.ERROR,
        message: 'You have not yet verified your email. You need to verify your email before you can login.',
        data: null
      }
    }

    // check for password match.
    const passwordMatch = await bcrypt.compare(password, userQuery._hashed_password.replace(/^\$2y/, '$2a') ?? '')

    // if the user is on a temporary ban and it's still ongoing, we return an error.
    if (userQuery.loginData?.tempBan && !userQuery.loginData?.permanentBan) {
      const unbanDate = new Date(userQuery.loginData.unbanDate!).getTime()
      const now = new Date().getTime()

      const diff = unbanDate - now

      const timeDiffMins = Math.floor(diff / 1000 / 60)
      const timeDiffHours = Math.floor(diff / 1000 / 60 / 60)

      // if the password matches and the time diff is <= 0, we unban the user.
      // instead of using a scheduler which is quite costly for us, this would be a temporary solution.
      if (passwordMatch && diff <= 0) {
        await userQuery.updateOne({ $set: { 'loginData.tempBan': false, 'loginData.unbanDate': null }})
        console.log(`User ${email} has been unbanned due to successful login and ban time being expired.`)
      } else {
        return {
          status: Status.ERROR,
          message: `You have been temporarily banned from logging in for ${timeDiffHours} hours and ${timeDiffMins} minutes. Please try again later`,
          data: null
        }
      }
    }

    if (userQuery.loginData?.tempBan && userQuery.loginData?.permanentBan) {
      return {
        status: Status.ERROR,
        message: 'Your account has been locked from too many unsuccessful attempts. Please contact support.',
        data: null
      }
    }

    // if password doesn't match, we add 1 unsuccessful login attempt to the user's loginData and return an error
    if (!passwordMatch) {
      // if the user doesn't have loginData yet, we create it and then return an error.
      if (!userQuery.loginData) {
        userQuery.loginData = {
          unsuccessfulAttempts: 1,
          tempBan: false,
          unbanDate: null,
        }

        await userQuery.save()

        return {
          status: Status.ERROR,
          message: 'Email does not exist or password is incorrect. You have 4 more attempts. Please try again.',
          data: null
        }
      }

      const unsuccessfulAttempts = userQuery.loginData.unsuccessfulAttempts

      // if the user so far has less than 4 unsuccessful attempts, we increment by 1.
      if (unsuccessfulAttempts < 4) {
        await User.updateOne({ email: email }, { $inc: { 'loginData.unsuccessfulAttempts': 1 } })

        console.log({
          status: Status.ERROR,
          message: `Email does not exist or password is incorrect. You have ${4 - userQuery.loginData.unsuccessfulAttempts} more attempt(s). Please try again.`,
          data: null
        })

        return {
          status: Status.ERROR,
          message: `Email does not exist or password is incorrect. You have ${4 - userQuery.loginData.unsuccessfulAttempts} more attempt(s). Please try again.`,
          data: null
        }
      }

      // if the user has 4 or more unsuccessful attempts at this point, the next attempt will cause a temporary ban (5th attempt).
      // for every try the user does after the 5th attempt, the duration of the ban will double.
      // a scheduler will remove these temporary bans after some time.
      if (userQuery.loginData.unsuccessfulAttempts >= 4) {
        if (userQuery.loginData.unsuccessfulAttempts === 4) {
          await User.updateOne(
            { email: email },
            {
              $inc: { 'loginData.unsuccessfulAttempts': 1 },
              $set: {
                'loginData.tempBan': true,
                'loginData.permanentBan': null,
                'loginData.unbanDate': new Date(Date.now() + 30 * 60 * 1000)
              }
            }
          )

          return {
            status: Status.ERROR,
            message: 'You have been temporarily banned from logging in for 30 minutes. Please try again later',
            data: null
          }
        }

        // if more than 5 attempts, double the duration for every attempt increment.
        if (userQuery.loginData.unsuccessfulAttempts > 4) {
          await User.updateOne(
            { email: email },
            {
              $inc: { 'loginData.unsuccessfulAttempts': 1 },
              $set: {
                'loginData.tempBan': true,
                'loginData.permanentBan': null,
                'loginData.unbanDate': new Date(Date.now() + 30 * 60 * 1000 * (userQuery.loginData.unsuccessfulAttempts - 3))
              }
            }
          )

          return {
            status: Status.ERROR,
            message: `You have been temporarily banned from logging in for ${30 * (userQuery.loginData.unsuccessfulAttempts - 3)} minutes. Please try again later`,
            data: null
          }
        }

        if (userQuery.loginData.unsuccessfulAttempts >= 9) {
          await User.updateOne(
            { email: email },
            {
              $set: {
                'loginData.tempBan': true,
                'loginData.permanentBan': true,
                'loginData.unbanDate': null
              }
            }
          )

          return {
            status: Status.ERROR,
            message: 'Your account has been locked from too many unsuccessful attempts. Please contact support.',
            data: null
          }
        }
      }
    }

    // if the password matches, log the user in and generate a JWT token.
    const token = jwt.sign(
      { userId: userQuery._id, email: userQuery.email },
      process.env.JWT_SECRET ?? '',
      { expiresIn: '1h' }
    )

    // if a user has unsuccessful attempts previously, reset it.
    if (userQuery.loginData?.unsuccessfulAttempts) {
      await User.updateOne({ email: email }, { $set: { 'loginData.unsuccessfulAttempts': 0 } })
    }

    return {
      status: Status.SUCCESS,
      message: 'Login successful. JWT token generated.',
      data: {
        email: userQuery.email,
        token: token,
      }
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `checkIfVerificationTokenExists` checks whether the user has a verification token.
 * 
 * this check is mainly used for accounts that were created with metamask and before 25 august.
 * 
 * this is because these accounts will NOT have a verification token, and will need to have one created for them to verify their email to be able to log in via email.
 * @param email the user's email
 * @returns a ReturnValue instance
 */
export const checkIfVerificationTokenExists = async (email: string): Promise<ReturnValue> => {
  try {
    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User not found',
        data: null
      }
    }

    if (userQuery.verificationData?.verificationToken) {
      return {
        status: Status.SUCCESS,
        message: 'User has a verification token',
        data: {
          hasVerificationToken: true,
        }
      }
    }

    if (!userQuery.verificationData?.verificationToken) {
      return {
        status: Status.SUCCESS,
        message: 'User does not have a verification token',
        data: {
          hasVerificationToken: false,
        }
      }
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `checkIfVerified` checks whether the user has verified their email.
 * @param email the user's email
 */
export const checkIfVerified = async (email: string): Promise<ReturnValue> => {
  try {
    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    // if user isn't found, we return an error
    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User not found',
        data: null
      }
    }

    if (userQuery.hasVerified) {
      return {
        status: Status.SUCCESS,
        message: 'User has already verified their email',
        data: {
          verified: true,
        }
      }
    }

    if (!userQuery.hasVerified) {
      return {
        status: Status.SUCCESS,
        message: 'User has not verified their email',
        data: {
          verified: false,
        }
      }
    }

    return {
      status: Status.ERROR,
      message: 'Something went wrong',
      data: null
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `checkVerificationStatus` combines both `checkIfVerificationExists` and `checkIfVerified` to check whether the user has verified their email.
 * @param email the user's email
 * @returns a ReturnValue instance
 */
export const checkVerificationStatus = async (email: string): Promise<ReturnValue> => {
  try {
    const verificationTokenExists = await checkIfVerificationTokenExists(email)
    const verified = await checkIfVerified(email)

    if (verificationTokenExists.status === Status.ERROR || verified.status === Status.ERROR) {
      return {
        status: Status.ERROR,
        message: 'Something went wrong: verificationTokenExists:' + verificationTokenExists.message + ' verified: ' + verified.message,
        data: null
      }
    }

    return {
      status: Status.SUCCESS,
      message: 'Successfully checked verification status',
      data: {
        hasVerificationToken: verificationTokenExists.data?.hasVerificationToken,
        verified: verified.data?.verified,
      }
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}

/**
 * `checkWalletExists` checks whether the user has a wallet address.
 * @param email the user's email
 * @returns a ReturnValue instance
 */
export const checkWalletExists = async (email: string): Promise<ReturnValue> => {
  try {
    const User = mongoose.model('_User', UserSchema, '_User')
    const userQuery = await User.findOne({ email: email })

    if (!userQuery) {
      return {
        status: Status.ERROR,
        message: 'User not found',
        data: null
      }
    }

    return {
      status: Status.SUCCESS,
      message: 'Successfully checked wallet',
      data: {
        wallet: userQuery.ethAddress,
      }
    }
  } catch (err: any) {
    console.log({
      status: Status.ERROR,
      message: err,
      data: null
    })

    return {
      status: Status.ERROR,
      message: err,
      data: null
    }
  }
}