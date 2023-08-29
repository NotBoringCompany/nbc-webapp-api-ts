import express, { Request, Response } from 'express'
import { checkIfVerificationTokenExists, checkIfVerified, checkVerificationStatus, checkWalletExists, createVerificationToken, emailLogin, registerAccount, verifyJwtToken, verifyToken } from '../../api/webapp/account'
import { Status } from '../../utils/retVal'
import { checkAuth } from '../../middlewares/checkAuth'
import { ALLOWED_ORIGINS } from '../../server'

const router = express.Router()

router.get('/check-auth', (req: Request, res: Response) => {
    try {
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
    } catch (error) {
        console.error('Error in check-auth:', error);
        res.status(500).json({
            status: Status.ERROR,
            error: 'Internal Server Error',
            message: 'An internal server error occurred.',
            data: null
        });
    }
});

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

router.post('/create-verification-token', async (req: Request, res: Response) => {
    const { email, password, jwtToken } = req.body

    try {
        const { status, message, data } = await createVerificationToken(email, password ?? null, jwtToken ?? null)
        res.json(status === Status.ERROR ? {
            status,
            error: 'Creating verification token failed.',
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
            error: 'Creating verification token failed.',
            message: err,
            data: null
        })
    }
})

router.post('/verify-jwt-token', async (req: Request, res: Response) => {
    const { token } = req.body
    try {
        const decodedToken = verifyJwtToken(token)
        
        decodedToken ? res.status(200).json({
            status: Status.SUCCESS,
            error: null,
            message: 'Verifying JWT token successful.',
            data: {
                decodedToken
            }
        }) : res.status(401).json({
            status: Status.ERROR,
            error: 'Verifying JWT token failed.',
            message: 'Verifying JWT token failed.',
            data: null
        })
    } catch (err: any) {
        res.status(500).json({
            status: Status.ERROR,
            error: 'Verifying JWT token failed. JWT probably is expired.',
            message: err,
            data: null
        })
    }
})

router.post('/email-login', async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
        const { status, message, data } = await emailLogin(email, password);

        res.json(status === Status.ERROR ? {
            status,
            error: 'Logging in with email failed.',
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
            error: 'Logging in with email failed.',
            message: err,
            data: null
        });
    }
});

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

router.get('/check-if-verification-token-exists/:email', async (req: Request, res: Response) => {
    try {
        const { email } = req.params
        const { status, message, data } = await checkIfVerificationTokenExists(email)

        res.json(status === Status.ERROR ? {
            status,
            error: 'Checking if verification token exists failed.',
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
            error: 'Checking if verification token exists failed.',
            message: err,
            data: null
        })
    }
})

router.get('/check-verification-status/:email', async (req: Request, res: Response) => {
    try {
        const { email } = req.params
        const { status, message, data } = await checkVerificationStatus(email)

        res.json(status === Status.ERROR ? {
            status,
            error: 'Checking verification status failed.',
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
            error: 'Checking verification status failed.',
            message: err,
            data: null
        })
    }
})

router.get('/check-wallet-exists/:email', async (req: Request, res: Response) => {
    try {
        const { email } = req.params
        const { status, message, data } = await checkWalletExists(email)

        res.json(status === Status.ERROR ? {
            status,
            error: 'Checking wallet exists failed.',
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
            error: 'Checking wallet exists failed.',
            message: err,
            data: null
        })
    }
})

export default router