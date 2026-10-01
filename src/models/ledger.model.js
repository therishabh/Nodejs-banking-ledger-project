const mongoose = require('mongoose');

// Ledger = account ki books ka entry. Har transaction ke 2 entries bante hain:
// fromAccount par DEBIT aur toAccount par CREDIT. Entries ek baar ban gayi to kabhi change/delete nahi hoti.
const ledgerSchema = new mongoose.Schema({
    // ye entry kis account ki hai
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'Ledger must be associated with an account'],
        index: true, // account ki ledger entries / balance fast nikalne ke liye
        immutable: true, // ban jane ke baad badal nahi sakta
    },
    // entry ka paisa (hamesha positive; credit ya debit `type` se pata chalta hai)
    amount: {
        type: Number,
        required: [true, 'Amount is required for creating a ledger entry'],
        immutable: true,
    },
    // ye entry kis transaction ki wajah se bani
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "transaction",
        required: [true, "Ledger mush be associated with a transaction"],
        index: true,
        immutable: true
    },
    // CREDIT = account me paisa aaya, DEBIT = account se paisa gaya
    type: {
        type: String,
        enum: {
            values: ["CREDIT", "DEBIT"],
            message: "Ledger type can only be CREDIT or DEBIT"
        },
        required: [true, "Ledger type is required"],
        immutable: true
    }
});

// Immutability: update/delete wali saari query methods par hook lagaya hai.
// Ye hook error throw karta hai, isliye operation DB tak pahunchta hi nahi.
// (`immutable: true` sirf field change roke hai, delete nahi; isliye ye hooks bhi chahiye)
function preventLedgerModification(next) {
    throw new Error("Ledger entries cannot be modified after creation");
}

ledgerSchema.pre('findOneAndUpdate', preventLedgerModification);
ledgerSchema.pre('updateOne', preventLedgerModification);
ledgerSchema.pre('deleteOne', preventLedgerModification);
ledgerSchema.pre('updateMany', preventLedgerModification);
ledgerSchema.pre('remove', preventLedgerModification);
ledgerSchema.pre('deleteMany', preventLedgerModification);
ledgerSchema.pre('findOneAndRemove', preventLedgerModification);
ledgerSchema.pre('findOneAndReplace', preventLedgerModification);
ledgerSchema.pre('findOneAndDelete', preventLedgerModification);

const LedgerModel = mongoose.model('ledger', ledgerSchema);
module.exports = LedgerModel;
