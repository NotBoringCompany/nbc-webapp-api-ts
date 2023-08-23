import Mailgun from 'mailgun.js'
import formData from 'form-data'
import * as dotenv from 'dotenv'
import path from 'path'
import { checkEmailExists, verificationMsg, verificationTemplate } from '../../utils/emailUtils'
import { ReturnValue, Status } from '../../utils/retVal'
import { UserSchema } from '../../schemas/User'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { generateObjectId } from '../../utils/cryptoUtils'

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

    // create a new user doc
    const newUser = new User({
      _id: generateObjectId(),
      email: email,
      _hashed_password: hashedPassword,
      _created_at: Date.now(),
      _updated_at: Date.now(),
    })

    await newUser.save()

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

// mg.messages
//   .create('nbcompany.io', verificationMsg('INSERT VERIFICATION LINK HERE'))
//   .then((msg) => console.log(msg))
//   .catch((err) => {
//     console.error('Mailgun Error:', err)

//     if (err.response && err.response.status === 401) {
//       console.error('Authentication error. Check your API key.')
//     } else {
//       console.error('Other error occurred.')
//     }
//   })