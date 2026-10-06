/**
 * ApiError = "jaanbujhkar" fail hui request ka error (jaise 400, 401, 404, 409).
 *
 * Controller me ab `return sendResponse(res, 400, '...')` ki jagah ye likhte hain:
 *   throw new ApiError(400, 'Missing required fields');
 *
 * `throw` karte hi Express 5 us error ko global error handler (error.middleware.js) tak
 * bhej deta hai, wahi final response banata hai. Isse controller me sirf "happy path" bachta hai.
 *
 * Example:
 *   throw new ApiError(404, 'Account not found');
 *   throw new ApiError(409, 'Already exists', { status: 'pending' }); // extra fields response me jaate hain
 */
class ApiError extends Error {
    constructor(statusCode, message, extra = {}) {
        super(message);

        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.extra = extra; // response JSON me message/status ke saath jodne wale fields

        // Stack trace me ApiError ka constructor na dikhe, seedha wo line dikhe jahan throw hua
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = ApiError;
