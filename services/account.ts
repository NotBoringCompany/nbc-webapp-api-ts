import Moralis from 'moralis-v1/node';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import * as SMTPTransport from 'nodemailer/lib/smtp-transport';
import { Status } from '../utils/retVal';


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
    
    const passwordResetRequests = Moralis.Object.extend('ForgotPasswordRequests');
    const newPasswordResetRequest = new passwordResetRequests();
    const tokenId = crypto.randomBytes(150).toString('hex');
    newPasswordResetRequest.set('email', email);
    newPasswordResetRequest.set('tokenId', tokenId);
    newPasswordResetRequest.set('validUntil', Date.now() + TWO_HOURS_IN_MS); // valid until two more hours

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
            service: 'gmail',
			auth: {
				type: 'OAUTH2',
				user: AUTHOIRSED_EMAIL,
				clientId: CLIENT_ID,
				clientSecret: CLIENT_SECRET,
				refreshToken: REFRESH_TOKEN,
				accessToken: accessToken.token || '',
			}
          }

		const transport = nodemailer.createTransport(nodemailerOptions)

		const mailOptions = {
			from: `Realm Hunter <${AUTHOIRSED_EMAIL}>`,
			to: emailAddress,
			subject: 'Realm Hunter: Reset your password',
			html: `Hey there! <br/> <br/> Someone requested a password change for an account with this email address. Please ignore this message if you don't want to change your password. <br/><br/> <a target='_blank' rel='noopener noreferrer' href='${FRONTEND_DOMAIN}/reset-password?rtk=${tokenId}'>Click this link to reset your password</a>. This link will be valid for 2 hours. <br/><br/> Sincerly, your Realm Hunter team. 😊`,
		};

		const result = transport.sendMail(mailOptions);
		return result;
	} catch (error) {
		console.error('Error sending!')
        throw('Something went wrong')
	}
};

/**
 * `verifyRPT` checks if RPT (reset password token) is valid
 * @param tokenId / RPT (reset password token) is a token used for the reset password process.
 *  
 * A valid RPT:
 * 1. Has a length of more than 150 chars, typically 300.
 * 2. Exists in DB (ForgotPasswordRequests).
 * 3. Hasn't expired yet (less than 2 hours old).
 */
const verifyRPT = async (tokenId: string) => {
	try {
		if (tokenId.length < 150) return { valid: false, email: null };

		const passwordResetRequests = Moralis.Object.extend(
			'ForgotPasswordRequests'
		);
		const passwordResetRequestQuery = new Moralis.Query(passwordResetRequests);
		passwordResetRequestQuery.equalTo('tokenId', tokenId);
		const queryResult = await passwordResetRequestQuery.first({
			useMasterKey: true,
		});

        if (queryResult) {
            
			const jsonResult = JSON.parse(JSON.stringify(queryResult));
			
            const notExpired = jsonResult.validUntil > Date.now();
			return { valid: notExpired, email: notExpired ? jsonResult.email : null };
		}

		return { valid: false, email: null };
	} catch (err) {
		throw (err)
	}
};


/**
 * `resetPasswordService` resets / changes user's password to a new one
 * @param tokenId / RPT (reset password token) is a token used for the reset password process
 * @param newPassword new password for the user (min. 6 chars)
 * @param confirmNewPassword value has to be the same with `newPassword`
 */

const resetPasswordService = async (tokenId: string, newPassword: string, confirmNewPassword: string) => {
	try {
		if (newPassword !== confirmNewPassword)
			throw ('Passwords are not the same');

        if (newPassword.length < 6) {
            throw ('Password must be of at least 6 characters long')
        }
		const { email } = await verifyRPT(tokenId);
		if (email) {
			const users = Moralis.Object.extend('_User');

			const userQuery = new Moralis.Query(users);
			userQuery.equalTo('email', email.toLowerCase());

			const userQueryResult = await userQuery.first({
				useMasterKey: true,
			});

			if (userQueryResult) {
                userQueryResult.set('password', newPassword);
                await userQueryResult.save(null, { useMasterKey: true });
                await deleteForgotPasswordRequest(tokenId);
                return { reset: true }
            }
        }
        throw ('Something went wrong. Password has not been reset');
	} catch (err) {
		throw (err);
	}
};

/**
 * `deleteForgotPasswordRequest` deletes a record/row in the ForgotPasswordRequests class by its tokenId.
 * @param tokenId / RPT (reset password token) is a token used for the reset password process
 */
const deleteForgotPasswordRequest = async (tokenId: string) => {
	const passwordResetRequests = Moralis.Object.extend("ForgotPasswordRequests");

	const passwordResetRequestQuery = new Moralis.Query(passwordResetRequests);
	passwordResetRequestQuery.equalTo("tokenId", tokenId);

	const object = await passwordResetRequestQuery.first({
		useMasterKey: true,
	});

	if (object) object.destroy({ useMasterKey: true });
};


export { createPasswordResetRequest, sendResetPasswordEmail, verifyRPT, resetPasswordService }
