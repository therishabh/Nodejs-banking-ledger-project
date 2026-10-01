const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref: "user", // user.model.js me jo model name diya hai wahi
        required: [true, "Account must be associated with a user"]
    },
    status : {
        type : String, // type ke bina mongoose `status` ko nested object samajh leta hai
        enum : {
            values: ["ACTIVE", "FROZEN", "CLOSED"],
            message : "Status can be either ACTIVE, FROZEN or CLOSED"
        },
        default : "ACTIVE"
    },
    currency : {
        type : String,
        uppercase: true, // "inr" -> "INR"
        trim: true,
        default: "INR"
    }
}, {
    timestamps: true
})

// user ke accounts (aur status ke saath filter) fast nikalne ke liye.
// Ye index `user` akele ki query bhi cover karta hai, isliye alag se user par index nahi lagaya.
accountSchema.index({user: 1, status: 1})

const accountModel = mongoose.model('account', accountSchema);

module.exports = accountModel;
