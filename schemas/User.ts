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
    }, {
        versionKey: false,
    }
)