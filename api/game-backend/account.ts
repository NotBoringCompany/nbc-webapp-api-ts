import { createPasswordResetRequest, sendResetPasswordEmail } from '../../services/account'
import { getMoralisUser } from '../../services/moralis'
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

export const sendResetPasswordRequest = async (email: string): Promise<ReturnValue> => {
    try {
        const user = await getMoralisUser(email);
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