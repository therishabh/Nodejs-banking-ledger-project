const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const { sendRegistrationEmail } = require('../services/email.service');
const { sendResponse } = require('../utils/response');
const ApiError = require('../utils/ApiError');

/**
 * - User Register Controller
 * - POST /api/auth/register
 *
 * try/catch nahi hai: validation error, duplicate email (E11000) jaise errors
 * seedha global error handler (error.middleware.js) sambhalta hai.
 */
async function userRegisterController(req, res) {
    // Express 5 me body na ho to req.body undefined hota hai, isliye `?? {}`
    const { email, password, name } = req.body ?? {};
    const isEmailExists = await userModel.findOne({ email });

    if (isEmailExists) {
        throw new ApiError(422, 'User already exists with this email.');
    }

    const user = await userModel.create({
        email,
        name,
        password,
    });

    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign({ userId: user._id }, jwtSecret, {
        expiresIn: '3d',
    });

    // httpOnly: JS (document.cookie) se cookie read nahi hogi, XSS se token chori nahi hoga
    // maxAge: 3 din (ms me), token ki expiry ke barabar
    // sameSite: dusri site se aayi request me cookie nahi jayegi (CSRF se bachav)
    // secure: production me sirf HTTPS par cookie jayegi
    res.cookie('jwt_token', token, {
        httpOnly: true,
        maxAge: 3 * 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
    });

    sendResponse(res, 201, 'User has been successfully created', {
        user: {
            id: user._id,
            email: user.email,
            name: user.name,
        },
        token: token,
    });

    // Response ja chuka hai. Email fail ho to usi ko log karo, dobara response / error handler nahi chalana
    // (headers already sent hone par dusra response bhejne se ERR_HTTP_HEADERS_SENT aata hai).
    try {
        await sendRegistrationEmail(email, name);
    } catch (error) {
        console.error('Registration email failed:', error);
    }
}

/**
 * - User Login Controller
 * - POST /api/auth/login
 */
async function userLoginController(req, res) {
    const { email, password } = req.body ?? {};

    // email / password na ho to findOne({ email: undefined }) kisi bhi user ko match kar sakta hai, isliye pehle hi roko
    if (!email || !password) {
        throw new ApiError(400, 'Email and password are required');
    }

    // password field me select:false hai, isliye login me .select("+password") zaroori hai
    const user = await userModel.findOne({ email }).select('+password');

    if (!user) {
        throw new ApiError(401, 'Email or password is not valid');
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
        throw new ApiError(401, 'Email or password is not valid');
    }

    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign({ userId: user._id }, jwtSecret, {
        expiresIn: '3d',
    });

    // httpOnly: JS (document.cookie) se cookie read nahi hogi, XSS se token chori nahi hoga
    // maxAge: 3 din (ms me), token ki expiry ke barabar
    // sameSite: dusri site se aayi request me cookie nahi jayegi (CSRF se bachav)
    // secure: production me sirf HTTPS par cookie jayegi
    res.cookie('jwt_token', token, {
        httpOnly: true,
        maxAge: 3 * 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
    });

    sendResponse(res, 200, 'User has been successfully login', {
        user: {
            id: user._id,
            email: user.email,
            name: user.name,
        },
        token: token,
    });
}

async function userLogoutController(req, res) {
    const token = req.cookies?.jwt_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return sendResponse(res, 200, 'User logged out successfully');
    }

    res.clearCookie("jwt_token");

    return sendResponse(res, 200, 'User logged out successfully');
}

module.exports = {
    userRegisterController,
    userLoginController,
    userLogoutController
};
