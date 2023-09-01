import mongoose from 'mongoose'
import { ReturnValue, Status } from '../../utils/retVal'
import { InviteCodesSchema } from '../../schemas/InviteCodes'
import crypto from 'crypto'

/**
 * `generateInviteCodes` generates invite codes for a specific `purpose` (such as for Alpha V1 (the game), or for other purposes).
 * @param amount the amount of invite codes to generate
 * @param purpose the purpose of the invite codes
 * @param adminPassword the admin password to generate the invite codes
 * @returns a ReturnValue instance
 */
export const generateInviteCodes = async (
    amount: number, 
    purpose: string, 
    multiUse: boolean, 
    maxUses: number,
    adminPassword: string
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
                inviteCode: crypto.randomBytes(16).toString('hex'),
                purpose,
                redeemed: false,
                redeemedBy: null,
                redeemedAt: null,
                multiUse: multiUse,
                maxUses: maxUses,
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