import mongoose from 'mongoose'
import { ReturnValue, Status } from '../../utils/retVal'
import { InviteCodesSchema } from '../../schemas/InviteCodes'
import crypto from 'crypto'
import { generateObjectId } from '../../utils/cryptoUtils'
import * as referralCodes from 'referral-codes'

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

        // we check the purpose of this invite code.
        const inviteCodeQuery = await InviteCodes.findOne({ inviteCode: inviteCode })
        if (!inviteCodeQuery) {
            return {
                status: Status.ERROR,
                message: 'Invalid invite code.',
                data: null
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
        const InviteCodes = mongoose.model('InviteCodes', InviteCodesSchema, 'InviteCodes')

        const inviteCodesArr = Array.from({ length: amount })

        const inviteCodes = inviteCodesArr.map(() => {
            return {
                _id: generateObjectId(),
                inviteCode: referralCodes.generate({
                    length: 20,
                    count: 1,
                    prefix: purpose.replace(/\s/g, '').toUpperCase(),
                }),
                purpose,
                redeemed: false,
                redeemedBy: null,
                redeemedAt: null,
                multiUse: multiUse,
                maxUses: maxUses,
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