const userModel = require('./../models/user.model');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

/**
 * Protected routes ke liye: token verify karke `req.user` set karta hai.
 * try/catch nahi hai: jwt.verify() galat / expire token par khud throw karta hai
 * (JsonWebTokenError / TokenExpiredError), aur global error handler use 401 bana deta hai.
 */
async function authMiddleware(req, res, next) {
    const token =
        req.cookies?.jwt_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        throw new ApiError(401, 'Unauthorized access, token is missing');
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decodedToken.userId);

    if (!user) {
        throw new ApiError(401, 'Unauthorized access, token is invalid');
    }

    req.user = user;
    return next();
}

/**
 * Sirf system user (bank) ke liye. authMiddleware jaisa hi, bas user ka `systemUser` flag bhi check hota hai.
 */
async function systemUserAuthMiddleware(req, res, next) {
    const token = req.cookies?.jwt_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        throw new ApiError(401, 'Unauthorized access, token is missing');
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decodedToken.userId).select('+systemUser'); // systemUser field ko explicitly select karna hoga kyunki default me select:false hai

    if (!user || !user.systemUser) {
        throw new ApiError(401, 'Unauthorized access, token is invalid or user is not a system user');
    }

    req.user = user;
    return next();
}

module.exports = {
    authMiddleware,
    systemUserAuthMiddleware,
};
