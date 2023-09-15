import express, { Request, Response } from 'express'
import { Status } from '../../utils/retVal'
import { generateInviteCodes, redeemInviteCode } from '../../api/webapp/inviteCodes'

const router = express.Router()

router.post('/generate-invite-codes', async (req: Request, res: Response) => {
    const { amount, purpose, multiUse, maxUses, expiryDate, adminPassword } = req.body
    
    try {
        const { status, message, data } = await generateInviteCodes(adminPassword, amount, purpose, multiUse, maxUses, expiryDate)
        res.json(status !== Status.SUCCESS ? {
            status: status,
            error: message,
            message: null,
            data: null
        } : {
            status: status,
            error: null,
            message: message,
            data: data
        })
    } catch (err: any) {
        res.status(500).json({
            status: Status.ERROR,
            error: 'Error in generating invite codes.',
            message: err,
            data: null
        })
    }
})

router.post('/redeem-invite-code', async (req: Request, res: Response) => {
    const { inviteCode, email, uniqueHash } = req.body

    try {
        const { status, message, data } = await redeemInviteCode(inviteCode, email, uniqueHash)
        res.json(status !== Status.SUCCESS ? {
            status: status,
            error: message,
            message: null,
            data: null
        } : {
            status: status,
            error: null,
            message: message,
            data: data
        })
    } catch (err: any) {
        res.status(500).json({
            status: Status.ERROR,
            error: 'Error in redeeming invite code.',
            message: err,
            data: null
        })
    }
})

export default router