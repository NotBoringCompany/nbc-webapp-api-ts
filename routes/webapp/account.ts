import express, { Request, Response } from 'express'
import { emailLogin, registerAccount, verifyToken } from '../../api/webapp/account'
import { Status } from '../../utils/retVal'

const router = express.Router()

router.post('/register-account', async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
        const { status, message, data } = await registerAccount(email, password)
        res.json(status === Status.ERROR ? {
            status,
            error: 'Registering account failed.',
            message: message,
            data: null
     } : {
        status,
        error: null,
        message: message,
        data
     })
    } catch (err: any) {
        res.status(500).json({
            status: Status.ERROR,
            error: 'Registering account failed',
            message: err,
            data: null
        })
    }
})

router.post('/verify-token', async (req: Request, res: Response) => {
    const { email, token } = req.body

    try {
        const { status, message, data } = await verifyToken(email, token)
        res.json(status === Status.ERROR ? {
            status,
            error: 'Verifying token failed.',
            message: message,
            data: null
        } : {
            status,
            error: null,
            message: message,
            data
        })
    } catch (err) {
        res.status(500).json({
            status: Status.ERROR,
            error: 'Verifying token failed.',
            message: err,
            data: null
        })
    }
})

router.post('/email-login', async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
        const { status, message, data } = await emailLogin(email, password)

        res.json(status === Status.ERROR ? {
            status,
            error: 'Logging in with email failed.',
            message: message,
            data: null
        }: {
            status,
            error: null,
            message: message,
            data
        })
    } catch (err: any) {
        res.status(500).json({
            status: Status.ERROR,
            error: 'Logging in with email failed.',
            message: err,
            data: null
        })
    }
})

export default router