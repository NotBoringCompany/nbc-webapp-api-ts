import express, { Request, Response } from 'express'
import { moralisLogin } from '../../../api/game-backend/account'
import { Status } from '../../../utils/retVal'
import { verifyOwnership } from '../../../api/nfts/kos/ownership'
const router = express.Router()

router.get('/verify-ownership/:wallet', async (req: Request, res: Response) => {
    const { wallet } = req.params

    try {
        const { status, message, data } = await verifyOwnership(wallet)
        res.json(status === Status.ERROR ? {
            status,
            error: 'Ownership verification failed.',
            message: message,
            data: null
        } : {
            status,
            error: null,
            message: message,
            data
        })
    } catch (err: any) {
        res.status(err.code).json({
            status: Status.ERROR,
            error: 'Ownership verification failed.',
            message: err,
            data: null
        })
    }
})

export default router
