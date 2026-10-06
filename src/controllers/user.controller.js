const accountModel = require('../models/account.model');
const { sendResponse } = require('../utils/response');

/**
 * - GET /api/me
 * - Logged in user ki info (+ uska account, agar bana hua hai)
 * - protected route: authMiddleware token verify karke `req.user` set kar deta hai
 */
async function getMeController(req, res) {
    const currentUser = req.user;

    // User ka account (agar abhi tak create nahi kiya to null). ek user ka ek hi account hota hai.
    const account = await accountModel
        .findOne({ user: currentUser._id })
        .select('_id status currency')
        .lean();

    return sendResponse(res, 200, 'User info has been successfully fetched', {
        // sirf kaam ke fields bhej rahe hain. password / systemUser kabhi nahi jaate
        // (password select:false hai, aur yahan explicitly list karne se galti se leak nahi hoga)
        user: {
            id: currentUser._id,
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
            isActive: currentUser.isActive,
            createdAt: currentUser.createdAt,
        },
        account: account
            ? { accountId: account._id, status: account.status, currency: account.currency }
            : null,
    });
}

module.exports = {
    getMeController,
};
