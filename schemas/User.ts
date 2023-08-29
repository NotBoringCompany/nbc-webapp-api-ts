import mongoose from 'mongoose'

/**
 * Full user schema found in the _User collection
 */
export const UserSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: new mongoose.Types.ObjectId(),
        },
        username: String,
        _wperm: Array,
        _rperm: Array,
        _auth_data_moralisEth: Object,
        _acl: Object,
        _created_at: Date,
        _updated_at: Date,
        accounts: Array,
        ethAddress: String,
        _hashed_password: String,
        email: String,
        uniqueHash: String,
        // stores the token that is sent to the user's email for verification and the expiry date.
        verificationData: Object,
        // checks whether the user has verified their account via email or not.
        hasVerified: Boolean,
        // checks the amount of invalid attempts the user has made to login within 24 hours and optionally a temporary ban if exceeded.
        loginData: Object,
        // includes: prevEmail, newEmailUnverified (email user changed to but hasnt been verified yet), newEmailVerified (once user verifies the new email), changeVerificationData and changeDate.
        // note that `changeVerificationData` is the same as `verificationData`, but is stored inside `emailChangeData` to differentiate between the two. the former is used any time the user changes email
        emailChangeData: Object,
    }, {
        versionKey: false,
    }
)