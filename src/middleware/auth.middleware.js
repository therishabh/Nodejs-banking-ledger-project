const userModel = require('./../models/user.model');
const jwt = require('jsonwebtoken');

async function authMiddleware(req, res, next) {
    const token =
        req.cookies?.jwt_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        // return zaroori hai, warna neeche ka code bhi chalega aur dobara response bhejne par ERR_HTTP_HEADERS_SENT aayega
        return res.status(401).json({
            status: 'failed',
            message: 'Unauthorized access, token is missing',
        });
    }

    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decodedToken.userId);

        if (!user) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized access, token is invalid',
            });
        }

        req.user = user;
        return next();
    } catch (err) {
        return res.status(401).json({
            status: 'failed',
            message: 'Unauthorized access, token is invalid',
        });
    }
}

module.exports = {
    authMiddleware,
};
