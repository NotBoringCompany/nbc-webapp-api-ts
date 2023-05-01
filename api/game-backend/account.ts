import { ReturnValue, Status } from '../../utils/retVal'
import Moralis from 'moralis-v1/node'

/**
 * `moralisLogin` logs the user in via Moralis.
 * @param email the user's email
 * @param password the user's password
 * @returns a ReturnValue instance
 */
export const moralisLogin = async (email: string, password: string): Promise<ReturnValue> => {
    try {
        const user = await Moralis.User.logIn(email, password)

        return {
            status: Status.SUCCESS,
            message: `Login to Moralis successful. User email: ${email}`,
            data: {
                sessionToken: user.get('sessionToken'),
                uniqueHash: user.get('uniqueHash')
            }
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