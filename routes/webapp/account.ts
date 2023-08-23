import express, { Request, Response } from 'express'
import { registerAccount } from '../../api/webapp/account'
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

export default router