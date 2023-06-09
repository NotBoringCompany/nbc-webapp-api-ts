import mongoose from 'mongoose'

/**
 * Session schema for querying (only includes fields that are needed for querying)
 */
export const SessionQuerySchema = new mongoose.Schema(
    {
        _session_token: String,
        // pointer to the user's _User object ID in the _User collection
        _p_user: String
    }, {
        versionKey: false,
    }
)

/**
 * User schema for querying (only includes fields that are needed for querying)
 */
export const UserQuerySchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: new mongoose.Types.ObjectId(),
        },
        username: String,
        ethAddress: String,
        email: String,
        uniqueHash: String
    }, {
        versionKey: false,
    }
)