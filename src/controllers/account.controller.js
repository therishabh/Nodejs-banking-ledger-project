const accountModel = require('./../models/account.model');
const userModel = require('./../models/user.model');
const { sendResponse } = require('../utils/response');

async function createAccountController(req, res) {
    const currentUser = req.user;
    // Express 5 me body na bheji ho to req.body undefined hota hai, isliye `?? {}`
    // Aisa hone par currency/status undefined rahenge aur schema ke default (INR, ACTIVE) lag jayenge
    const { currency, status } = req.body ?? {};

    const isAccountExist = await accountModel.findOne({
        user: currentUser._id
    })

    if (isAccountExist) {
        return sendResponse(res, 400, "Account already created");
    }

    const account = await accountModel.create({
        user: currentUser._id,
        currency: currency,
        status: status,
    });

    return sendResponse(res, 201, 'Account has been successfully created', { account });
}

/**
 * - GET /api/accounts
 * - Saare ACTIVE accounts ki list (account id + user ka name)
 * - Logged in user ka apna account aur system users ke accounts list me nahi aate
 * - protected route
 */
async function listAccountController(req, res) {
    const currentUser = req.user;

    // Pehle saare system users ki ids nikaalo (inke accounts list me nahi chahiye).
    // `systemUser` me select:false hai, par filter me use karne ke liye .select('+systemUser') ki zaroorat nahi.
    const systemUsers = await userModel.find({ systemUser: true }).select('_id').lean();
    const systemUserIds = systemUsers.map((user) => user._id);

    const accounts = await accountModel
        .find({
            status: 'ACTIVE',
            // $nin = "in me nahi": apna account + saare system users ke accounts list se bahar
            user: { $nin: [currentUser._id, ...systemUserIds] },
        })
        .select('_id user') // sirf zaroori fields (currency, timestamps etc. nahi)
        .populate('user', 'name') // user ID ki jagah user ka name (aur _id) le aao
        // lean(): Mongoose document ki jagah plain JS object do (fast + halka).
        // Sirf read karna hai, .save() ya custom methods (getBalance etc.) nahi chahiye, isliye safe hai.
        .lean();

    // populate ke baad user object hota hai ({ _id, name }), usse simple { accountId, name } bana do
    const accountList = accounts.map((account) => ({
        // account ki apni id (isi id par transfer / initial funds bhejte hain)
        accountId: account._id,
        // populate se aaye user object ka name. `?.` isliye ki agar user delete ho gaya ho
        // (populate null deta hai) to crash na ho, name bas undefined rahega
        name: account.user?.name,
    }));

    return sendResponse(res, 200, 'Account list has been successfully fetched', {
        accounts: accountList,
    });
}

/**
 * - GET /api/accounts/balance
 * - Logged in user ke account ka current balance (ledger se derive hota hai: CREDIT - DEBIT)
 * - protected route
 */
async function getBalanceController(req, res) {
    const currentUser = req.user;

    const currentAccount = await accountModel.findOne({ user: currentUser._id });

    // User ne abhi account create nahi kiya -> null par .getBalance() call karne se crash hota
    if (!currentAccount) {
        return sendResponse(res, 404, 'Account not found for this user, please create an account first');
    }

    const balance = await currentAccount.getBalance();

    return sendResponse(res, 200, 'Account balance has been successfully fetched', {
        accountId: currentAccount._id,
        balance,
        currency: currentAccount.currency,
    });
}

module.exports = {
    createAccountController,
    listAccountController,
    getBalanceController,
};
