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
import Moralis from 'moralis-v1'

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
    await mongoose.connect(process.env.MONGODB_URI ?? '')
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
export const emailLogin = async (email: string, password: string): Promise<ReturnValue> => {
  try {
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
    if (!userQuery.loginData.tempBan) {
      const unbanDate = new Date(userQuery.loginData.unbanDate!).getTime()
      const now = new Date().getTime()

      const diff = unbanDate - now

      const timeDiffMins = Math.floor(diff / 1000 / 60)
      const timeDiffHours = Math.floor(diff / 1000 / 60 / 60)
      return {
        status: Status.ERROR,
        message: `You have been temporarily banned from logging in for ${timeDiffHours} hours and ${timeDiffMins} minutes. Please try again later`,
      }
    }

    // check for password.
    const passwordMatch = await bcrypt.compare(password, userQuery._hashed_password!)

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

      // if the user has loginData and has less than 5 unsuccessful attempts so far, we increment the unsuccessfulAttempts by 1.
      userQuery.loginData.unsuccessfulAttempts += 1
      if (userQuery.loginData.unsuccessfulAttempts < 5) {
        await userQuery.save()

        return {
          status: Status.ERROR,
          message: `Email does not exist or password is incorrect. You have ${5 - userQuery.loginData.unsuccessfulAttempts} more attempt(s). Please try again.`,
          data: null
        }
      }
      // if the user has 5 unsuccessful attempts at this point (or more), we set a temporary ban of 30 minutes.
      // for every increment of 1 afterwards, we double this duration up to 24 hours.
      // if the amount has reached 10, we set a permanent ban.
      // this will be resetted by the scheduler each day.
      if (userQuery.loginData.unsuccessfulAttempts >= 5) {
        if (userQuery.loginData.unsuccessfulAttempts === 5) {
          userQuery.loginData.tempBan = true
          // 30 minute ban
          userQuery.loginData.unbanDate = new Date(Date.now() + 30 * 60 * 1000)

          await userQuery.save()

          return {
            status: Status.ERROR,
            message: 'You have been temporarily banned from logging in for 30 minutes. Please try again later',
            data: null
          }
        }

        // if more than 5 attempts, double the duration for every attempt increment.
        if (userQuery.loginData.unsuccessfulAttempts > 5) {
          // set this to true regardless, just as a precaution
          userQuery.loginData.tempBan = true
          // double the duration for every increment
          userQuery.loginData.unbanDate = new Date(Date.now() + 30 * 60 * 1000 * (userQuery.loginData.unsuccessfulAttempts - 4))

          await userQuery.save()

          return {
            status: Status.ERROR,
            message: `You have been temporarily banned from logging in for ${30 * (userQuery.loginData.unsuccessfulAttempts - 4)} minutes. Please try again later`,
            data: null
          }
        }

        if (userQuery.loginData.unsuccessfulAttempts >= 10) {
          userQuery.loginData.tempBan = true
          userQuery.loginData.permanentBan = true
          userQuery.loginData.unbanDate = null

          await userQuery.save()

          return {
            status: Status.ERROR,
            message: 'Your account has been locked from too many unsuccessful attempts. Please contact support.',
            data: null
          }
        }
      }
    }

    // if the password matches, log the user in and use Moralis's built in session management (for now, to be updated).
    const user = await Moralis.User.logIn(email, password)

    return {
      status: Status.SUCCESS,
      message: `Login successful. Redirecting...`,
      data: {
        sessionToken: user.get('sessionToken'),
        uniqueHash: user.get('uniqueHash'),
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