const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const { sendRegistrationEmail } = require('../services/email.service');
const { sendResponse } = require('../utils/response');

/**
 * - User Register Controller
 * - POST /api/auth/register
 */
async function userRegisterController(req, res) {
    try {
        const { email, password, name } = req.body;
        const isEmailExists = await userModel.findOne({ email });

        if (isEmailExists) {
            return sendResponse(res, 422, 'User already exists with this email.');
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

        await sendRegistrationEmail(email, name);
    } catch (error) {
        // schema validation fail (galat email, chhota password, etc.)
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors)
                .map((e) => e.message)
                .join(', ');
            return sendResponse(res, 400, message);
        }

        // do request ek saath aayi to unique index duplicate email par E11000 deta hai
        if (error.code === 11000) {
            return sendResponse(res, 422, 'User already exists with this email.');
        }

        console.error('Register error:', error);
        return sendResponse(res, 500, 'Something went wrong, please try again later.');
    }
}

/**
 *
 *
 */

async function userLoginController(req, res) {
    const { email, password } = req.body;

    // password field me select:false hai, isliye login me .select("+password") zaroori hai
    const user = await userModel.findOne({ email }).select('+password');

    if (!user) {
        return sendResponse(res, 401, 'Email or password is not valid');
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
        return sendResponse(res, 401, 'Email or password is not valid');
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
