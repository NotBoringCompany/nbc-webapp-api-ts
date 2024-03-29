import { createPasswordResetRequest, resetPasswordService, sendResetPasswordEmail, verifyRPT } from '../../services/account'
import { ReturnValue, Status } from '../../utils/retVal'
import Moralis from 'moralis-v1/node'
import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import path from 'path'
import { SessionQuerySchema, UserQuerySchema } from '../../schemas/Session'
import { UserSchema } from '../../schemas/User'
import { InviteCodesSchema } from '../../schemas/InviteCodes'
import { verifyOwnership } from '../nfts/kos/ownership'

/**
 * `verifyAlphaAccess` checks whether a user is able to play the Alpha V1 of our mainline game.
 * It requires that the user has either: a valid invite code, or a Key Of Salvation.
 * This requirement may change in the future.
 * @param email the user's email
 * @returns a ReturnValue instance
 */
export const verifyAlphaAccess = async (email: string): Promise<ReturnValue> => {
    try {
        if (!email) {
            return {
                status: Status.ERROR,
                message: 'Email is required.',
                data: null
            }
        }
        
        // we query for the user's wallet first
        const User = mongoose.model('User', UserSchema, '_User')
        const userQuery = await User.findOne({ email: email })

        if (!userQuery) {
            return {
                status: Status.ERROR,
                message: 'User not found.',
                data: null
            }
        }

        // we now fetch the user's wallet address
        const walletAddress = userQuery.ethAddress

        // if the user doesn't have a wallet address, we check if they have a valid invite code.
        if (!walletAddress) {
            const InviteCodes = mongoose.model('InviteCodes', InviteCodesSchema, 'InviteCodes')
            const inviteCodeQuery = await InviteCodes.findOne({ redeemedBy: email, purpose: 'Alpha V1' })

            if (!inviteCodeQuery) {
                return {
                    status: Status.ERROR,
                    message: 'User does not have a valid invite code for Alpha V1.',
                    data: null
                }
            } else {
                return {
                    status: Status.SUCCESS,
                    message: 'User has a valid invite code for Alpha V1.',
                    data: null
                }
            }
        } else {
            // if user has a wallet address, we check if they have a Key Of Salvation.
            const ownership = await verifyOwnership(walletAddress)
            if (ownership) {
                return {
                    status: Status.SUCCESS,
                    message: 'User has a Key Of Salvation.',
                    data: null
                }
            // otherwise, we check if they have a valid invite code.
            } else {
                const InviteCodes = mongoose.model('InviteCodes', InviteCodesSchema, 'InviteCodes')
                const inviteCodeQuery = await InviteCodes.findOne({ redeemedBy: email, purpose: 'Alpha V1' })

                if (!inviteCodeQuery) {
                    return {
                        status: Status.ERROR,
                        message: 'User does not have a valid invite code for Alpha V1.',
                        data: null
                    }
                } else {
                    return {
                        status: Status.SUCCESS,
                        message: 'User has a valid invite code for Alpha V1.',
                        data: null
                    }
                }
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
 * `ownsAlphaInviteCode` checks whether a user owns an invite code for Alpha V1.
 * @param email the user's email
 * @returns a ReturnValue instance
 */
export const ownsAlphaInviteCode = async (email: string): Promise<ReturnValue> => {
    try {
        if (!email) {
            return {
                status: Status.ERROR,
                message: 'Email is required.',
                data: null
            }
        }

        const InviteCodes = mongoose.model('InviteCodes', InviteCodesSchema, 'InviteCodes')
        const inviteCodeQuery = await InviteCodes.findOne({ redeemedBy: email, purpose: 'Alpha V1' })

        if (!inviteCodeQuery) {
            return {
                status: Status.ERROR,
                message: 'User does not have a valid invite code for Alpha V1.',
                data: {
                    hasInviteCode: false
                }
            }
        }

        return {
            status: Status.SUCCESS,
            message: 'User has a valid invite code for Alpha V1.',
            data: {
                hasInviteCode: true
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
 * fetches a user's wallet address from their session token
 * @param sessionToken the user's session token
 * @returns a ReturnValue instance
 */
export const fetchWalletFromSessionToken = async (sessionToken: string): Promise<ReturnValue> => {
    try {
        const Session = mongoose.model('Session', SessionQuerySchema, '_Session')
        const sessionQuery = await Session.findOne({ _session_token: sessionToken })
        if (!sessionQuery) {
            return {
                status: Status.ERROR,
                message: 'Session token not found',
                data: null
            }
        }

        // if session token is found, we query the _User collection.
        // first, we split the pointer to get the user object ID.
        const userPointer = sessionQuery._p_user?.split('_User$')[1]

        // then, we query the _User collection using the user object ID.
        const User = mongoose.model('User', UserQuerySchema, '_User')
        const userQuery = await User.findOne({ _id: userPointer })
        if (!userQuery) {
            return {
                status: Status.ERROR,
                message: 'User not found',
                data: null
            }
        }

        // if user is found, we return the user's wallet address.
        const walletAddress = userQuery.ethAddress
        
        return {
            status: Status.SUCCESS,
            message: 'Session token found',
            data: {
                walletAddress
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