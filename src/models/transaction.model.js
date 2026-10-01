const mongoose = require('mongoose');

// Transaction = ek account se doosre account me paisa bhejne ka record
const transactionModel = new mongoose.Schema(
    {
        // paisa kis account se kata
        fromAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'account', // account.model.js me jo model name diya hai wahi
            required: [true, 'From account is required'],
            index: true, // kisi account ki transactions fast nikalne ke liye
        },
        // paisa kis account me gaya
        toAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'account',
            required: [true, 'To account is required'],
            index: true,
        },
        // transaction ki current halat. Shuru me PENDING, baad me COMPLETED / FAILED / REVERTED
        status: {
            type: String,
            enum: {
                values: ['PENDING', 'COMPLETED', 'FAILED', 'REVERTED'],
                message:
                    'Status can only be PENDING, COMPLETED, FAILED or REVERTED',
            },
            default: 'PENDING',
        },
        // kitna paisa bhejna hai
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            // 0 ya negative amount allow nahi, kam se kam 1 paisa (0.01) hona chahiye
            min: [0.01, 'Amount must be greater than 0'],
        },
        // Idempotency key: client har transaction ke saath ek unique key bhejta hai.
        // Network retry / double click par same request dobara aaye to same key milegi,
        // aur unique index ki wajah se duplicate transaction (double debit) nahi banega.
        idempotencyKey: {
            type: String,
            required: [true, 'Idempotency key is required'],
            unique: true, // unique ka index khud ban jata hai, alag se `index: true` ki zaroorat nahi
        },
    },
    {
        timestamps: true, // createdAt, updatedAt apne aap
    },
);

const TransactionModel = mongoose.model('transaction', transactionModel);
module.exports = TransactionModel;
