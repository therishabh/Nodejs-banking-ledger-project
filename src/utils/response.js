/**
 * Common API response helper.
 * Har jagah `res.status(..).json({ message, status, ... })` repeat karne ki jagah
 * ye use karo, taaki response ka shape ek hi jagah se control ho.
 *
 * Response shape: { message, status, ...extra }
 * - `status` auto set hota hai: statusCode < 400 -> 'success', warna 'failed'
 * - Special case (jaise 202 pending) me `extra` me `status` bhej do, wo override kar dega
 *
 * Example:
 *   return sendResponse(res, 201, 'Created', { transaction });
 *   return sendResponse(res, 400, 'Missing fields');
 *   return sendResponse(res, 202, 'In progress', { status: 'pending' });
 */
function sendResponse(res, statusCode, message, extra = {}) {
    return res.status(statusCode).json({
        message,
        status: statusCode < 400 ? 'success' : 'failed',
        ...extra,
    });
}

module.exports = { sendResponse };
