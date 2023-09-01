import mongoose from 'mongoose'
import { ReturnValue, Status } from '../../utils/retVal'
import { InviteCodesSchema } from '../../schemas/InviteCodes'
import crypto from 'crypto'
import { generateObjectId } from '../../utils/cryptoUtils'
import * as referralCodes from 'referral-codes'
import { UserSchema } from '../../schemas/User'

/**
 * `redeemInviteCode` redeems an invite code.
 * 
 * Note: for now, a user can only redeem an invite code for each specific purpose once.
 * @param inviteCode the invite code to redeem
 * @param email the email of the user redeeming the invite code
 * @param uniqueHash the unique hash of the user redeeming the invite code (this is required to prevent users from redeeming invite codes for other users)
 * @returns a ReturnValue instance
 */
export const redeemInviteCode = async (inviteCode: string, email: string, uniqueHash: string): Promise<ReturnValue> => {
    try {
        if (!uniqueHash) {
            return {
                status: Status.ERROR,
                message: 'Unique hash is required.',
                data: null
            }
        }

        const InviteCodes = mongoose.model('InviteCodes', InviteCodesSchema, 'InviteCodes')
        const inviteCodeQuery = await InviteCodes.findOne({ inviteCode: inviteCode })

        if (!inviteCodeQuery) {
            return {
                status: Status.ERROR,
                message: 'Invalid invite code.',
                data: null
            }
        }
        
        // if invite code is found, we check if it has expired.
        if (inviteCodeQuery.expiryDate < new Date()) {
            return {
                status: Status.ERROR,
                message: 'Invite code has expired.',
                data: null
            }
        }

        // we now check if it the code has been redeemed.
        // note that invite codes can be redeemed multiple times if `multiUse` is true.
        // thus, we first check if multiUse is true as the logic will differ.
        if (inviteCodeQuery.multiUse) {
            if (inviteCodeQuery.timesUsed + 1 > inviteCodeQuery.maxUses) {
                return {
                    status: Status.ERROR,
                    message: 'Invite code has been redeemed too many times.',
                    data: null
                }
            }
        } else {
            // this check now implies that invite code is only single use.
            // we check if it has been redeemed.
            if (inviteCodeQuery.redeemed || !!inviteCodeQuery.redeemedBy) {
                return {
                    status: Status.ERROR,
                    message: 'Invite code has already been redeemed.',
                    data: null
                }
            }
        }

        // we now check for the purpose of the invite code.

        // if invite code is not redeemed, we check if the user has already redeemed an invite code for this purpose.
        // if yes, we return an error.
        // NOTE: This is a temporary measure to prevent users from redeeming multiple invite codes for the same purpose.
        // In the future, we may allow users to redeem multiple invite codes for the same purpose.
        // NOTE 2: if `multiUse` is true, we query the `multiUseRedeemData` instead as `redeemedBy` will be null.
        let userInviteCodeQuery: any

        if (inviteCodeQuery.multiUse) {
           const userInviteCodeQuery = await InviteCodes.findOne({ 'multiUseRedeemData.email': email, purpose: inviteCodeQuery.purpose })
        } else {
            userInviteCodeQuery = await InviteCodes.findOne({ redeemedBy: email, purpose: inviteCodeQuery.purpose })
        }

        if (userInviteCodeQuery) {
            return {
                status: Status.ERROR,
                message: 'You have already redeemed an invite code for this event/purpose.',
                data: null
            }
        }

        // if user has not redeemed an invite code for this purpose, we redeem the invite code.
        // we first check if the email's unique hash matches with `uniqueHash`.
        // if yes, we redeem the invite code.
        const User = mongoose.model('_User', UserSchema, '_User')
        const userQuery = await User.findOne({ email: email })

        if (!userQuery) {
            return {
                status: Status.ERROR,
                message: 'User not found.',
                data: null
            }
        }

        if (userQuery.uniqueHash !== uniqueHash) {
            return {
                status: Status.ERROR,
                message: 'Invalid unique hash.',
                data: null
            }
        }

        // if unique hash is valid, we redeem the invite code.
        // if `multiUse` is true, we push the redeem data to `multiUseRedeemData`.
        // if `multiUse` is false, we set `redeemed` to true, `redeemedBy` to the user's email and `redeemedAt` to the current date.
        if (inviteCodeQuery.multiUse) {
            const redeemData = {
                email: email,
                redeemedAt: new Date()
            }

            await inviteCodeQuery.updateOne({ $push: { multiUseRedeemData: redeemData }, $inc: { timesUsed: 1 } })
        } else {
            await inviteCodeQuery.updateOne({ redeemed: true, redeemedBy: email, redeemedAt: new Date(), $inc: { timesUsed: 1 } })
        }

        return {
            status: Status.SUCCESS,
            message: 'Invite code redeemed successfully.',
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
 * `generateInviteCodes` generates invite codes for a specific `purpose` (such as for Alpha V1 (the game), or for other purposes).
 * @param amount the amount of invite codes to generate
 * @param purpose the purpose of the invite codes
 * @param adminPassword the admin password to generate the invite codes
 * @returns a ReturnValue instance
 */
export const generateInviteCodes = async (
    adminPassword: string,
    amount: number, 
    purpose: string, 
    multiUse: boolean, 
    maxUses: number,
    // expiry date in unix
    expiryDate?: number,
): Promise<ReturnValue> => {
    try {
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return {
                status: Status.ERROR,
                message: 'Invalid admin password.',
                data: null
            }
        }

        if (maxUses <= 0) {
            return {
                status: Status.ERROR,
                message: 'Max uses must be greater than 0.',
                data: null
            }
        }

        if (!purpose) {
            return {
                status: Status.ERROR,
                message: 'Purpose is required.',
                data: null
            }
        }

        if (!amount) {
            return {
                status: Status.ERROR,
                message: 'Amount is required.',
                data: null
            }
        }

        const InviteCodes = mongoose.model('InviteCodes', InviteCodesSchema, 'InviteCodes')

        const inviteCodesArr = Array.from({ length: amount })

        const inviteCodes = inviteCodesArr.map(() => {
            const code = referralCodes.generate({
                length: 20,
                count: 1,
                prefix: purpose.replace(/\s/g, '').toUpperCase(),
            })

            return {
                _id: generateObjectId(),
                // `code` returns an array of strings. we take the 0th index since we only do 1 code at a time.
                inviteCode: code[0],
                purpose,
                // the default value of `redeemed` is false if maxUses is 1, and null if maxUses is > 1.
                redeemed: maxUses === 1 ? false : null,
                redeemedBy: null,
                redeemedAt: null,
                multiUse: multiUse,
                maxUses: maxUses,
                multiUseRedeemData: [],
                // if expiry date is not provided, we set it to 7 days from now (default)
                expiryDate: expiryDate ? new Date(expiryDate * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                timesUsed: 0
            }
        })

        await InviteCodes.insertMany(inviteCodes)

        return {
            status: Status.SUCCESS,
            message: 'Invite codes generated successfully.',
            data: {
                amount: amount,
                purpose: purpose,
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
            
        }
    }
}