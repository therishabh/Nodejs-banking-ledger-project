const accountModel = require('./../models/account.model');
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

module.exports = {
    createAccountController,
};
