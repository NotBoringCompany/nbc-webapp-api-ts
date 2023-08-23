import Mailgun from 'mailgun.js'
import formData from 'form-data'
import * as dotenv from 'dotenv'
import path from 'path'
import { verificationMsg, verificationTemplate } from '../../utils/emailUtils'

dotenv.config({ path: path.join(__dirname, '../../.env') })

const mailgun = new Mailgun(formData)
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_KEY ?? '',
  url: 'https://api.eu.mailgun.net',
})

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