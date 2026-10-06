const mongoose = require('mongoose');
const LedgerModel = require('./ledger.model');

const accountSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user', // user.model.js me jo model name diya hai wahi
            required: [true, 'Account must be associated with a user'],
        },
        status: {
            type: String, // type ke bina mongoose `status` ko nested object samajh leta hai
            enum: {
                values: ['ACTIVE', 'FROZEN', 'CLOSED'],
                message: 'Status can be either ACTIVE, FROZEN or CLOSED',
            },
            default: 'ACTIVE',
        },
        currency: {
            type: String,
            uppercase: true, // "inr" -> "INR"
            trim: true,
            default: 'INR',
        },
    },
    {
        timestamps: true,
    },
);

// user ke accounts (aur status ke saath filter) fast nikalne ke liye.
// Ye index `user` akele ki query bhi cover karta hai, isliye alag se user par index nahi lagaya.
accountSchema.index({ user: 1, status: 1 });

accountSchema.methods.getBalance = async function () {
    const accountId = this._id;
    const balanceData = await LedgerModel.aggregate([
        { $match: { account: accountId } },
        {
            $group: {
                _id: null,
                creditBalance: {
                    $sum: {
                        $cond: [
                            { $eq: ['$type', 'CREDIT'] },
                            '$amount',
                            0
                        ]
                    }
                },
                debitBalance: {
                    $sum: {
                        $cond: [
                            { $eq: ['$type', 'DEBIT'] },
                            '$amount',
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: null,
                balance: { $subtract: ['$creditBalance', '$debitBalance'] }
            }
        }
    ]);

    return balanceData.length > 0 ? balanceData[0].balance : 0;
}

const accountModel = mongoose.model('account', accountSchema);

module.exports = accountModel;
