import express, { Request, Response } from 'express'
import { checkIfVerified, emailLogin, registerAccount, verifyToken } from '../../api/webapp/account'
import { Status } from '../../utils/retVal'
import { checkAuth } from '../../middlewares/checkAuth'
import { ALLOWED_ORIGINS } from '../../server'

const router = express.Router()

router.get('/check-auth', (req: Request, res: Response) => {    
    const origin = req.headers.origin;
    console.log('origin: ', origin)
    if (ALLOWED_ORIGINS.includes(origin)) {
        console.log('origin is allowed')
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    }

    console.log('req.session.user: ', req.session.user)

    if (req.session.user) {
        // user is authenticated
        res.status(200).json({
            status: Status.SUCCESS,
            error: null,
            message: 'User is authenticated.',
            data: {
                isAuthenticated: true,
                user: req.session.user
            }
         })
    } else {
        // user is not authenticated
        res.status(401).json({ 
            status: Status.ERROR,
            error: 'User is not authenticated.',
            message: 'User is not authenticated.',
            data: {
                isAuthenticated: false,
                user: null
            }
        })
    }
})

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
    } catch (err: any) {
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
        const { status, message, data } = await emailLogin(req, email, password);
        
        res.header('Access-Control-Allow-Credentials', 'true');

        if (status === Status.ERROR) {
            res.status(200).json({
                status,
                error: 'Logging in with email failed.',
                message: message,
                data: null
            });
        } else {
            res.cookie('session', data, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict'
            });

            res.status(200).json({
                status,
                error: null,
                message: message,
                data
            });
        }
    } catch (err: any) {
        res.status(500).json({
            status: Status.ERROR,
            error: 'Logging in with email failed.',
            message: err,
            data: null
        });
    }
});

router.post('/email-logout', checkAuth, async (req: Request, res: Response) => {
    req.session.destroy((err: Error) => {
        if (err) {
            console.error('Error destroying session: ', err)
            res.status(Status.ERROR).json({
                status: Status.ERROR,
                error: 'Logging out failed.',
                message: err,
                data: null
            })
        } else {
            res.status(Status.SUCCESS).json({
                status: Status.SUCCESS,
                error: null,
                message: 'Successfully logged out.',
                data: null
            })
        }
    })
})

router.get('/check-if-verified/:email', async (req: Request, res: Response) => {
    const { email } = req.params

    try {
        const { status, message, data } = await checkIfVerified(email)

        res.json(status === Status.ERROR ? {
            status,
            error: 'Checking if verified failed.',
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
            error: 'Checking if verified failed.',
            message: err,
            data: null
        })
    }
})

export default router