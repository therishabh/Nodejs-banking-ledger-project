const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/response');

/**
 * 404 handler: koi bhi route match nahi hua to ye chalta hai.
 * Isko saare routes ke BAAD lagana hai (app.js me).
 */
function notFoundHandler(req, res, next) {
    next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

/**
 * Global error handler: app ke saare errors yahin aate hain.
 * Express ko batane ke liye ki ye error handler hai, function me 4 arguments (err, req, res, next) zaroori hain.
 * Isko sabse LAST me lagana hai (404 handler ke bhi baad).
 *
 * Kaam: error ka type pehchano -> sahi statusCode + message nikalo -> sendResponse se bhej do.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    // Response pehle hi bhej chuke hain to dobara nahi bhej sakte, Express ke default handler ko do
    if (res.headersSent) {
        return next(err);
    }

    let statusCode = 500;
    let message = 'Something went wrong, please try again later.';
    let extra = {};

    if (err instanceof ApiError) {
        // Humne khud throw kiya hua error (400, 401, 404, 409...)
        statusCode = err.statusCode;
        message = err.message;
        extra = err.extra;
    } else if (err.name === 'ValidationError') {
        // Mongoose schema validation fail (galat email, chhota password, etc.)
        statusCode = 400;
        message = Object.values(err.errors)
            .map((e) => e.message)
            .join(', ');
    } else if (err.code === 11000) {
        // Unique index violation (duplicate email / duplicate idempotencyKey)
        const fields = Object.keys(err.keyPattern ?? err.keyValue ?? {}).join(', ');
        statusCode = 409;
        message = fields ? `Duplicate value for: ${fields}` : 'Duplicate value, already exists';
    } else if (err.name === 'CastError') {
        // Galat format ki id (jaise ObjectId ki jagah "abc")
        statusCode = 400;
        message = `Invalid value for ${err.path}`;
    } else if (err.name === 'TokenExpiredError') {
        // JWT expire ho gaya (TokenExpiredError, JsonWebTokenError ka child hai, isliye pehle check)
        statusCode = 401;
        message = 'Unauthorized access, token has expired';
    } else if (err.name === 'JsonWebTokenError') {
        // JWT galat / tampered
        statusCode = 401;
        message = 'Unauthorized access, token is invalid';
    } else if (err.type === 'entity.parse.failed') {
        // express.json() ko tuta hua JSON mila
        statusCode = 400;
        message = 'Invalid JSON in request body';
    }

    // Jo errors humne expect nahi kiye (bug / DB down): server log me poora error rakho.
    // Client ko internal detail sirf development me dikhao, production me leak nahi karna.
    if (statusCode === 500) {
        console.error('Unhandled error:', err);

        if (process.env.NODE_ENV !== 'production') {
            extra = { ...extra, error: err.message };
        }
    }

    return sendResponse(res, statusCode, message, extra);
}

module.exports = { notFoundHandler, errorHandler };
