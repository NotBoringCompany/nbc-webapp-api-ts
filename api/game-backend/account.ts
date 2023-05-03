import { createPasswordResetRequest, resetPasswordService, sendResetPasswordEmail, verifyRPT } from '../../services/account'
import { ReturnValue, Status } from '../../utils/retVal'
import Moralis from 'moralis-v1/node'

/**
 * `moralisLogin` logs the user in via Moralis.
 * @param email the user's email
 * @param password the user's password
 * @returns a ReturnValue instance
 */
export const moralisLogin = async (email: string, password: string): Promise<ReturnValue> => {
    try {
        const user = await Moralis.User.logIn(email, password)

        return {
            status: Status.SUCCESS,
            message: `Login to Moralis successful. User email: ${email}`,
            data: {
                sessionToken: user.get('sessionToken'),
                uniqueHash: user.get('uniqueHash'),
                walletAddress: user.get('ethAddress')
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
 * `sendResetPasswordRequest` sends reset password email
 * @param email the user's email
 * @returns a ReturnValue instance 
 */
export const sendResetPasswordRequest = async (email: string): Promise<ReturnValue> => {
    try {
        const users = Moralis.Object.extend('_User');
        const userQuery = new Moralis.Query(users);
        userQuery.equalTo('email', email.toLowerCase());
        const user = await userQuery.first({ useMasterKey: true });
        //if user with this email
        // is found
        if (user) {
            const tokenId = await createPasswordResetRequest(email);
            const response = await sendResetPasswordEmail(email, tokenId);
            return {
                status: Status.SUCCESS,
                message: `Email has been sent`,
                data: {
                    email: response?.accepted[0]
                }
            };  
        } else {
            //goes to catch block
            throw ('Something went wrong'); 
            //to prevent enumeration attack, 
            // we generalise error message and 
            // not tell users if this email doesn't exist
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: err,
            data: null
        };
    }
}

/**
 * `resetPasswordTokenCheck` checks reset password token using `verifyRPT`
 * @param tokenId / RPT (reset password token) is a token used for the reset password process
 * @returns a ReturnValue instance 
 */
export const resetPasswordTokenCheck = async (tokenId: string): Promise<ReturnValue> => {
    try {
        const data = await verifyRPT(tokenId);
        if (data.valid || !data) {
            return {
                status: Status.SUCCESS,
                message: `Token is valid`,
                data
            };
        } else {
            throw ('Token is invalid')
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: err,
            data: null
        };
    }
}

/**
 * `resetPassword` resets / changes user's password to a new one using `resetPasswordService`
 * @param tokenId / RPT (reset password token) is a token used for the reset password process
 * @param newPassword new password for the user (min. 6 chars)
 * @param confirmNewPassword value has to be the same with `newPassword`
 */

export const resetPassword = async (tokenId: string, newPassword: string, confirmNewPassword: string): Promise<ReturnValue> => {
    try {
        const data = await resetPasswordService(tokenId, newPassword, confirmNewPassword);
        if (data && data.reset) {
            return {
                status: Status.SUCCESS,
                message: `Password has been reset`,
                data
            };
        }

        //goes to catch block
        throw ('Something went wrong. Password has not been reset');
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: err,
            data: null
        };
    }
}