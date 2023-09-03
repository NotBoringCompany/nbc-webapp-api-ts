import express, { Request, Response } from 'express'
import { fetchWalletFromSessionToken, moralisLogin, resetPassword, resetPasswordTokenCheck, sendResetPasswordRequest, verifyAlphaAccess } from '../../api/game-backend/account'
import { Status } from '../../utils/retVal'

const router = express.Router()

router.get('/verify-alpha-access/:email' , async (req: Request, res: Response) => {
    const { email } = req.params

    try {
        const { status, message, data } = await verifyAlphaAccess(email)
        res.json(status === Status.ERROR ? {
            status,
            error: 'User does not have alpha access.',
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
            error: 'User does not have alpha access.',
            message: err,
            data: null
        })
    }
})

router.post('/moralis-login', async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
        const { status, message, data } = await moralisLogin(email, password)
        res.json(status === Status.ERROR ? {
            status,
            error: 'Login to Moralis failed.',
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
            error: 'Login to Moralis failed.',
            message: err,
            data: null
        })
    }
})

router.get('/fetch-wallet-from-session-token/:sessionToken', async (req: Request, res: Response) => {
    const { sessionToken } = req.params
    try {
        const { status, message, data } = await fetchWalletFromSessionToken(sessionToken)
        res.json(status === Status.ERROR ? {
            status,
            error: 'Fetching wallet from session token failed.',
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
            error: 'Fetching wallet from session token failed.',
            message: err,
            data: null
        })
    }
})

router.post('/reset-password-request', async (req: Request, res: Response) => {
    const { email } = req.body
    try {
        const { status, message, data } = await sendResetPasswordRequest(email);
        if (status === Status.ERROR) {
            //goes to catch block
            throw (message);
        }
        return res.json({
            status,
            error: null,
            message,
            data
        })
    } catch (error: any) {
        res.status(500).json({
            status: Status.ERROR,
            error,
            message: error,
            data: null
        })
    }
});

router.get('/reset-password-token-check/:tokenId', async (req: Request, res: Response) => {
    const { tokenId } = req.params
    try {
        const { status, message, data } = await resetPasswordTokenCheck(tokenId);
        if (status === Status.ERROR) {
            //goes to catch block
            throw (message);
        }
        return res.json({
            status,
            error: null,
            message,
            data
        })
    } catch (error: any) {
        res.status(500).json({
            status: Status.ERROR,
            error,
            message: error,
            data: null
        })
    }
});

router.post('/reset-password', async (req: Request, res: Response) => {
    const { tokenId, newPassword, confirmNewPassword } = req.body;
    try {
        const { status, message, data } = await resetPassword(tokenId, newPassword, confirmNewPassword);
        if (status === Status.ERROR) {
            //goes to catch block
            throw (message);
        }
        return res.json({
            status,
            error: null,
            message,
            data
        })
    } catch (error: any) {
        res.status(500).json({
            status: Status.ERROR,
            error,
            message: error,
            data: null
        })
    }
});

export default router