import mongoose from 'mongoose'

export const InviteCodesSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: new mongoose.Types.ObjectId(),
        },
        inviteCode: String,
        purpose: String, // the purpose of the invite code (such as granting access to Alpha V1)
        redeemed: Boolean,
        redeemedBy: String,
        redeemedAt: Date,
        multiUse: Boolean,
        maxUses: Number,
        timesUsed: Number,
        expiryDate: Date,
    }, {
        versionKey: false,
    }
)