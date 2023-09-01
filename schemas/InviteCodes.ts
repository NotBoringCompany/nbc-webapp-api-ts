import mongoose from 'mongoose'

export const InviteCodesSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: new mongoose.Types.ObjectId(),
        },
        inviteCode: String,
        purpose: String, // the purpose of the invite code (such as granting access to Alpha V1)
        // redeemed, redeemedBy and redeemedAt are only used if the invite code is single-use
        redeemed: Boolean,
        redeemedBy: String,
        redeemedAt: Date,
        multiUse: Boolean,
        // multiUseRedeemData is only used if the invite code is multi-use
        multiUseRedeemData: Array,
        maxUses: Number,
        timesUsed: Number,
        expiryDate: Date,
    }, {
        versionKey: false,
    }
)