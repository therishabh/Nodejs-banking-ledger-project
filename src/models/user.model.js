const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required for creating a user'],
            trim: true,
            lowercase: true, // hamesha lowercase save hoga, duplicate se bachne ke liye
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                'Please enter a valid email address',
            ],
            unique: true, // DB level unique index banata hai
        },
        name: {
            type: String,
            required: [true, 'Name is required for creating an account'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, "Name can't be more than 50 characters"],
        },
        password: {
            type: String,
            required: [true, 'Password is required for creating an account'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false, // query me default password nahi aayega
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        systemUser: {
            type: Boolean,
            default: false, // system ke liye internal user (jaise bank admin) banega to true
            immutable: true, // once set, cannot be changed
            select: false, // query me default systemUser nahi aayega
        },
        isActive: {
            type: Boolean,
            default: true, // account disable karna ho to delete ki jagah false kar do
        },
    },
    {
        timestamps: true, // createdAt aur updatedAt auto
    },
);

// Save se pehle password hash karo (sirf jab password change hua ho)
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// Login ke time use hoga. Note: query me .select("+password") zaroori hai
userSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password);
};

// userSchema.set(option, value) = schema ki setting badalta hai.
// Yahan "toJSON" option set kar rahe hain: jab bhi user document JSON me convert hoga
// (jaise res.json(user) ya JSON.stringify(user)), mongoose ye `transform` function chalayega.
//
// transform(doc, ret):
//   doc = original mongoose document (yahan use nahi kiya, isliye _doc)
//   ret = plain object jo JSON me jaane wala hai. Isme se cheezein delete karke return karo,
//         jo return hoga wahi client ko milega.
//
// Fayda: har jagah alag se password hatane ki zaroorat nahi, galti se leak nahi hoga.
// Note: sirf JSON output badalta hai, DB me data waisa hi rehta hai.
userSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete ret.password; // hashed password bhi client ko nahi dikhana
        delete ret.__v; // mongoose ka internal version key, kaam ka nahi
        return ret;
    },
});

const userModel = mongoose.model('user', userSchema);

module.exports = userModel;
