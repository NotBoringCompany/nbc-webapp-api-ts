import express, { Request, Response } from 'express'
import { moralisLogin } from '../api/game-backend/account'
import { Status } from '../utils/retVal'
const router = express.Router()

router.post('/moralis-login', async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
        const { status, message, data } = await moralisLogin(email, password)
        res.json(status === Status.ERROR ? {
            status,
            error: message,
            message: 'Login to Moralis failed.',
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
            error: err.message,
            message: 'Login to Moralis failed.',
            data: null
        })
    }
})

export default router