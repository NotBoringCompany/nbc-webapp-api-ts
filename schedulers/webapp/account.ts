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
        cron.schedule('*/10 * * * *', async () => {
            let updatedUsersCount = 0
            let deletedUsersCount = 0

            const User = mongoose.model('_User', UserSchema, '_User')
            // find users where `verificationData` exists, `hasVerified` is false and `verificationData.expiryDate` is less than or equal to the current time
            const userQuery = await User.find({ verificationData: { $exists: true }, hasVerified: false, 'verificationData.expiryDate': { $lte: new Date( ) } })

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

/**
 * Resets the login ban for all eligible users.
 * A login ban can happen when users fail to login too many times. 
 * Note that this scheduler will only remove temporary bans. Permanent bans must be resolved via support.
 */
export const resetLoginBan = async (): Promise<void> => {
    try {
        // runs every 10 minutes
        cron.schedule('*/10 * * * *', async () => {
            const User = mongoose.model('_User', UserSchema, '_User')
            // we find users where `loginData.tempBan` is true and `loginData.unbanDate` is less than or equal to the current time
            const userQuery = await User.find({ 'loginData.tempBan': true, 'loginData.unbanDate': { $lte: new Date() } })

            if (!userQuery || userQuery.length === 0) {
                return
            }

            // because all users that have a permanent ban have unbanDates that are set to `null`, we can safely assume that all users in `userQuery` have temporary bans.
            // therefore, we can just set `loginData.tempBan` to false and `loginData.unbanDate` to null.
            for (let i = 0; i < userQuery.length; i++) {
                const user = userQuery[i]
                await user.updateOne({ 'loginData.tempBan': false, 'loginData.unbanDate': null })
            }

            console.log(`successfully reset login ban for ${userQuery.length} users.`)
        })
    } catch (err: any) {
        console.log({
            status: Status.ERROR,
            error: 'Resetting login ban failed.',
            message: err,
        })
    }
}