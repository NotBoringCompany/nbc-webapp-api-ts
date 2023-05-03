import Moralis from "moralis-v1/node";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import crypto from "crypto";
import * as SMTPTransport from "nodemailer/lib/smtp-transport";


const TWO_HOURS_IN_MS = 7200 * 1000;
const CLIENT_ID = process.env.GOOGLE_APIS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_APIS_CLIENT_SECRET;
const REDIR_URL = process.env.GOOGLE_APIS_REDIR_URL;
const REFRESH_TOKEN = process.env.GOOGLE_APIS_REFRESH_TOKEN;
const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN;
const AUTHOIRSED_EMAIL = process.env.GOOGLE_APIS_AUTHORISED_EMAIL;

const oAuth2Client = new google.auth.OAuth2(
	CLIENT_ID,
	CLIENT_SECRET,
	REDIR_URL
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

/**
 * Creates a new record/row in the ForgotPasswordRequests class.
 * This record contains all the needed data for resetting a user's password.
 */
const createPasswordResetRequest = async (email: string) => {
    
    const passwordResetRequests = Moralis.Object.extend("ForgotPasswordRequests");
    const newPasswordResetRequest = new passwordResetRequests();
    const tokenId = crypto.randomBytes(150).toString("hex");
    newPasswordResetRequest.set("email", email);
    newPasswordResetRequest.set("tokenId", tokenId);
    newPasswordResetRequest.set("validUntil", Date.now() + TWO_HOURS_IN_MS); // valid until two more hours

    await newPasswordResetRequest.save();

    return tokenId;

    // no need to (can't) throw error here
    // because for whatever reason, Moralis 
    // doesn't even throw anything
    // when error occurs!
};

/**
 * Sends the forgot password email containing the reset password link
 * to an email address.
 */
const sendResetPasswordEmail = async (emailAddress: string, tokenId: string) => {
	try {
        const accessToken = await oAuth2Client.getAccessToken();
        
        const nodemailerOptions: SMTPTransport.Options = {
            service: "gmail",
			auth: {
				type: "OAUTH2",
				user: AUTHOIRSED_EMAIL,
				clientId: CLIENT_ID,
				clientSecret: CLIENT_SECRET,
				refreshToken: REFRESH_TOKEN,
				accessToken: accessToken.token || "",
			}
          }

		const transport = nodemailer.createTransport(nodemailerOptions)

		const mailOptions = {
			from: `Realm Hunter <${AUTHOIRSED_EMAIL}>`,
			to: emailAddress,
			subject: "Realm Hunter: Reset your password",
			html: `Hey there! <br/> <br/> Someone requested a password change for an account with this email address. Please ignore this message if you don't want to change your password. <br/><br/> <a target='_blank' rel='noopener noreferrer' href='${FRONTEND_DOMAIN}/reset-password?rtk=${tokenId}'>Click this link to reset your password</a>. This link will be valid for 2 hours. <br/><br/> Sincerly, your Realm Hunter team. 😊`,
		};

		const result = transport.sendMail(mailOptions);
		return result;
	} catch (error) {
		console.error('Error sending!')
        throw('Something went wrong')
	}
};

export { createPasswordResetRequest, sendResetPasswordEmail }
