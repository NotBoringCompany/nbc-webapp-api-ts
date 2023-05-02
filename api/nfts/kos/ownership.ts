import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'
import { ethers } from 'ethers'
import { ReturnValue, Status } from '../../../utils/retVal'

dotenv.config({ path: path.join(__dirname, '../../../.env') })

/// Key Of Salvation contract-related variables
const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ETH_API_KEY ?? ''}`
const rpcProvider = new ethers.providers.JsonRpcProvider(rpcUrl)
const kosABI = JSON.parse(
    (fs.readFileSync(
        path.join(__dirname, '../../../abi/KeyOfSalvation.json')
    )).toString()
)

const kosContract = new ethers.Contract(
    process.env.KOS_CONTRACT_ADDRESS ?? '',
    kosABI,
    rpcProvider
)

/**
 * Verifies whether a user owns at least 1 Key Of Salvation.
 * @param wallet the user's wallet address
 * @returns a ReturnValue instance
 */
export const verifyOwnership = async (wallet: string): Promise<ReturnValue> => {
    try {
        const ownerTokens = await kosContract.tokensOfOwner(wallet)

        if (!ownerTokens || ownerTokens.length === 0) {
            console.log({
                status: Status.ERROR,
                message: 'User does not own any Keys Of Salvation.',
                data: null
            })
            return {
                status: Status.ERROR,
                message: 'User does not own any Keys Of Salvation.',
                data: null
            }
        }

        console.log({
            status: Status.SUCCESS,
            message: 'User owns at least 1 Key Of Salvation.',
            data: null
        })
        return {
            status: Status.SUCCESS,
            message: 'User owns at least 1 Key Of Salvation.',
            data: null
        }
    } catch (err: any) {
        console.log({
            status: Status.ERROR,
            message: err,
            data: null
        })

        return {
            status: Status.ERROR,
            message: err,
            data: null
        }
    }
}

