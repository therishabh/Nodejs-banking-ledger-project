const userModel = require('./../models/user.model');
const jwt = require('jsonwebtoken');
const { sendResponse } = require('../utils/response');

async function authMiddleware(req, res, next) {
    const token =
        req.cookies?.jwt_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        // return zaroori hai, warna neeche ka code bhi chalega aur dobara response bhejne par ERR_HTTP_HEADERS_SENT aayega
        return sendResponse(res, 401, 'Unauthorized access, token is missing');
    }

    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decodedToken.userId);

        if (!user) {
            return sendResponse(res, 401, 'Unauthorized access, token is invalid');
        }

        req.user = user;
        return next();
    } catch (err) {
        return sendResponse(res, 401, 'Unauthorized access, token is invalid');
    }
}

async function systemUserAuthMiddleware(req, res, next) {
    const token = req.cookies?.jwt_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return sendResponse(res, 401, 'Unauthorized access, token is missing');
    }
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decodedToken.userId).select('+systemUser'); // systemUser field ko explicitly select karna hoga kyunki default me select:false hai

        if (!user || !user.systemUser) {
            return sendResponse(res, 401, 'Unauthorized access, token is invalid or user is not a system user');
        }

        req.user = user;
        return next();
    } catch (err) {
        return sendResponse(res, 401, 'Unauthorized access, token is invalid');
    }
}

module.exports = {
    authMiddleware,
    systemUserAuthMiddleware,
};
