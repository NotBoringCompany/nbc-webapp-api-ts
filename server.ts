import * as dotenv from 'dotenv'
import path from 'path'
import express from 'express'
import cors from 'cors'
import Moralis from 'moralis-v1/node'
import mongoose from 'mongoose'

dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
const port: string = process.env.PORT ?? '3000'
const mongoURI: string = process.env.MONGODB_URI ?? ''

/** ROUTE IMPORTS */
import backendAccount from './routes/game-backend/account'
import kosOwnership from './routes/nfts/kos/ownership'

/** MORALIS VARIABLES */
const serverUrl: string = process.env.MORALIS_SERVERURL ?? ''
const appId: string = process.env.MORALIS_APPID ?? ''
const masterKey: string = process.env.MORALIS_MASTERKEY ?? ''

/** EXPRESS MIDDLEWARES */
app.use(cors())
app.use(express.json())
/** END OF EXPRESS MIDDLEWARES */

/** ROUTES */
app.use('/backend-account', backendAccount)
app.use('/kos/ownership', kosOwnership)

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