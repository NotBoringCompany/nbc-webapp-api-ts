import {MailgunMessageData} from 'mailgun.js'
import mongoose from 'mongoose'
import { UserSchema } from '../schemas/User'

/**
 * `checkEmailExists` checks whether an email has already been registered in the _User database.
 * @param email the user's email
 */
export const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
        const User = mongoose.model('_User', UserSchema, '_User')
        const userQuery = await User.findOne({ email: email })
        
        return !!userQuery
    } catch (err: any) {
        console.log(err)
        return err
    }
}

/**
 * 
 * @param verificationLink the link that will be sent to the user's email for verification
 * @returns a MailgunMessageData object
 */
export const verificationMsg = (verificationLink: string): MailgunMessageData => ({
    from: 'support@nbcompany.io',
    to: ['suwandresukijat@gmail.com'],
    subject: 'Test',
    text: 'Testing Mailgun',
    html: verificationTemplate(verificationLink),
})

/**
 * @param verificationLink the link that will be sent to the user's email for verification
 * This template is used to send verification emails to users for creating their accounts via our webapp.
 */
export const verificationTemplate = (verificationLink: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* General styling for the email */
        body {
            font-family: 'Arial', sans-serif; /* Fallback font */
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #f5f5f5;
        }

        h1, h2, h3, p, a {
            font-family: 'Chakra Petch', Arial, sans-serif;
        }

        .success-color {
            color: #42ca9f;
        }
        .error-color {
            color: #ca4242;
        }

        /* Button styling (note: email clients may not fully support hover effects) */
        .verify-button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #42ca9f;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.2s, transform 0.2s;
        }
        .verify-button:hover {
            background-color: #42ca9f;
            transform: scale(1.01) translate(1px, -3px);
        }

        .logo {
            width: 100px;
        }

        .container {
            text-align: center;
            background-color: white; /* White box background */
            padding: 20px; /* Add padding to the white box */
            border-radius: 10px; /* Rounded corners for the white box */
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); /* Add a subtle shadow */
        }

        .email-background {
            background-color: #f5f5f5;
        }
    </style>
</head>
<body class="email-background">
    <div class="container">
        <div class="header">
            <img src="https://nbc-main.fra1.cdn.digitaloceanspaces.com/logos/LogoGreen1024x1024%20(2).png" alt="Not Boring Company Logo" class="logo">
            <h2>Welcome to Not Boring Company!</h2>
        </div>
        <div class="verification-text">
            <p>You've recently created an account on our web app. To get started, please verify your email address:</p>
            <p>
                <a href="{{verificationLink}}" class="verify-button">Verify Email Address</a>
            </p>
            <p class="error-color">If this isn't you, please ignore this email or report any suspicious behavior by sending an email back to us.</p>
        </div>
        <div class="footer">
            <p>Not Boring Company &copy; 2020-2023 All rights reserved.</p>
            <p>68 Circular Road, #02-01 Singapore 049422</p>
        </div>
    </div>
</body>
</html>
`