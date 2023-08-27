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
import { SessionSchema } from '../../schemas/Session'
import { Request } from 'express'

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
    await sendVerificationEmail(email, `https://webapp.nbcompany.io/verify?token=${verificationData.verificationToken}`)

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
 * `emailLogin` logs the user in via email and password.
 * @param email the user's email
 * @param password the user's password
 * @returns a ReturnValue instance
 */
export const emailLogin = async (req: Request, email: string, password: string): Promise<ReturnValue> => {
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

    // if a user has not verified their email, we return an error
    if (!userQuery.hasVerified) {
      return {
        status: Status.ERROR,
        message: 'You have not yet verified your email. You need to verify your email before you can login.',
        data: null
      }
    }


    // if the user is on a temporary ban, we return an error regardless of password matching.
    if (userQuery.loginData?.tempBan && !userQuery.loginData?.permanentBan) {
      const unbanDate = new Date(userQuery.loginData.unbanDate!).getTime()
      const now = new Date().getTime()

      const diff = unbanDate - now

      const timeDiffMins = Math.floor(diff / 1000 / 60)
      const timeDiffHours = Math.floor(diff / 1000 / 60 / 60)
      return {
        status: Status.ERROR,
        message: `You have been temporarily banned from logging in for ${timeDiffHours} hours and ${timeDiffMins} minutes. Please try again later`,
        data: null
      }
    }

    if (userQuery.loginData?.tempBan && userQuery.loginData?.permanentBan) {
      return {
        status: Status.ERROR,
        message: 'Your account has been locked from too many unsuccessful attempts. Please contact support.',
        data: null
      }
    }

    // check for password.
    const passwordMatch = await bcrypt.compare(password, userQuery._hashed_password ?? '')

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

    // if the password matches, log the user in and store their session using `express-session`
    const userSession = {
      id: userQuery._id,
      email: userQuery.email,
    }

    req.session.user = userSession

    return {
      status: Status.SUCCESS,
      message: 'Login successful. Session stored in cookie.',
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
        data: null
      }
    }

    if (!userQuery.hasVerified) {
      return {
        status: Status.SUCCESS,
        message: 'User has not verified their email',
        data: null
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