import express, { Request, Response } from 'express'
import { Status } from '../../utils/retVal'
import { generateInviteCodes } from '../../api/webapp/inviteCodes'

const router = express.Router()

router.post('/generate-invite-codes', async (req: Request, res: Response) => {
    const { amount, purpose, multiUse, maxUses, adminPassword } = req.body
    
    try {
        const { status, message, data } = await generateInviteCodes(amount, purpose, multiUse, maxUses, adminPassword)
        res.json(status === Status.ERROR ? {
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