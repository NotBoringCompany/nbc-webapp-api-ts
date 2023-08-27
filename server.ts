import * as dotenv from 'dotenv'
import path from 'path'
import express from 'express'
import cors from 'cors'
import Moralis from 'moralis-v1/node'
import mongoose from 'mongoose'
import session from 'express-session'
import cookieParser from 'cookie-parser'

dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
const port: string = process.env.PORT ?? '3000'
const mongoURI: string = process.env.MONGODB_URI ?? ''

/** ROUTE IMPORTS */
import backendAccount from './routes/game-backend/account'
import kosOwnership from './routes/nfts/kos/ownership'
import webappAccount from './routes/webapp/account'

/** MORALIS VARIABLES */
const serverUrl: string = process.env.MORALIS_SERVERURL ?? ''
const appId: string = process.env.MORALIS_APPID ?? ''
const masterKey: string = process.env.MORALIS_MASTERKEY ?? ''

/** EXPRESS MIDDLEWARES */
app.use(cors())
app.use(express.json())
app.use(cookieParser())
app.use(session({
    secret: process.env.SESSION_SECRET ?? '',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
    }
}))
/** END OF EXPRESS MIDDLEWARES */

/** ROUTES */
app.use('/backend-account', backendAccount)
app.use('/kos/ownership', kosOwnership)
app.use('/webapp', webappAccount)

app.listen(port, async () => {
    console.log(`Server is running on port ${port}`)
    await mongoose.connect(mongoURI)

    // initialize moralis
    await Moralis.start({
        serverUrl,
        appId,
        masterKey
    })
})