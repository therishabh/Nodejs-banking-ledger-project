const accountModel = require('./../models/account.model');

async function createAccountController(req, res) {
    const currentUser = req.user;
    // Express 5 me body na bheji ho to req.body undefined hota hai, isliye `?? {}`
    // Aisa hone par currency/status undefined rahenge aur schema ke default (INR, ACTIVE) lag jayenge
    const { currency, status } = req.body ?? {};

    const isAccountExist = await accountModel.findOne({
        user: currentUser._id
    })

    if (isAccountExist) {
        return res.status(400).json({
            status: "failed",
            message: "Account already created"
        })
    }

    const account = await accountModel.create({
        user: currentUser._id,
        currency: currency,
        status: status,
    });

    return res.status(201).json({
        message: 'Account has been successfully created',
        status: 'success',
        account,
    });
}

module.exports = {
    createAccountController,
};
