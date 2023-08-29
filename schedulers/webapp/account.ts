import cron from 'node-cron'
import mongoose from 'mongoose'
import { Status } from '../../utils/retVal'
import { UserSchema } from '../../schemas/User'

/**
 * Removes expired verification tokens from the database.
 * A user has up to 24 hours to verify their email once the token has been sent. Once 24 hours have passed, the token is considered expired.
 * This scheduler will run every 10 minutes to remove expired tokens.
 */
export const removeExpiredTokens = async (): Promise<void> => {
    try {
        cron.schedule('*/10 * * * * *', async () => {
            let updatedUsersCount = 0
            let deletedUsersCount = 0

            const User = mongoose.model('_User', UserSchema, '_User')
            // find users where `verificationData` exists and `verificationData.expiyDate` is less than or equal to the current time
            const userQuery = await User.find({ 'verificationData.expiryDate': { $lte: new Date() } })

            if (!userQuery || userQuery.length === 0) {
                return
            }

            // check, for each userQuery, if they have an ethAddress or only an email.
            for (let i = 0; i < userQuery.length; i++) {
                const user = userQuery[i]
                // if the user has an ethaddress and an email, then we remove the email associated AND remove the verificationData.
                if (user.ethAddress && user.email) {
                    await user.updateOne({ email: undefined, verificationData: undefined })
                    updatedUsersCount++
                } else if (!user.ethAddress && user.email) {
                    // if the user only has an email, then we delete their account.
                    await user.deleteOne()
                    deletedUsersCount++
                }
            }

            console.log(`successfully deleted ${deletedUsersCount} users and updated ${updatedUsersCount} users.`)
        })
    } catch (err: any) {
        console.log({
            status: Status.ERROR,
            error: 'Removing expired tokens failed.',
            message: err,
        })
    }
}

removeExpiredTokens()