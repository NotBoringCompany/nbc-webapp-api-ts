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