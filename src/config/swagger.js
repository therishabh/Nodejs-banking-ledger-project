const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

/**
 * Swagger / OpenAPI config.
 *
 * - `definition`: API ki general info (title, version), security (login kaise hota hai),
 *   aur reusable pieces (components: schemas, responses).
 * - `apis`: kin files me `@openapi` wale comments padhne hain. swagger-jsdoc in comments ko
 *   scan karke ek poora OpenAPI spec (JSON) bana deta hai, jisse Swagger UI page banta hai.
 */
const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'Backend Ledger API',
            version: '1.0.0',
            description:
                'Banking ledger backend: users, accounts, transfers aur ledger entries.\n\n' +
                '**Login kaise karein (Swagger me):**\n' +
                '1. `POST /api/auth/login` chalao, response me `token` milega.\n' +
                '2. Upar **Authorize** button dabao, token paste karo (bina `Bearer` likhe).\n' +
                '3. Ab protected routes (jinke saath lock icon hai) chalenge.',
        },
        // Relative URL: jis host/port pe docs khule hain, requests wahin jaayengi
        servers: [{ url: '/', description: 'Current server' }],
        tags: [
            { name: 'Auth', description: 'Register, login, logout' },
            { name: 'User', description: 'Logged in user ki info' },
            { name: 'Accounts', description: 'Account create, list, balance' },
            { name: 'Transactions', description: 'Paisa transfer karna' },
        ],
        components: {
            // Login ke 2 tareeke: Authorization header me JWT, ya `jwt_token` cookie (login ke baad browser khud bhejta hai)
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            // Reusable error responses: routes me `$ref: '#/components/responses/Unauthorized'` likh dene se kaam ho jaata hai
            responses: {
                Unauthorized: {
                    description: 'Token missing / invalid / expired',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ErrorResponse' },
                            example: {
                                message: 'Unauthorized access, token is missing',
                                status: 'failed',
                            },
                        },
                    },
                },
                BadRequest: {
                    description: 'Request galat hai (missing field, validation fail, business rule fail)',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ErrorResponse' },
                            example: { message: 'Missing required fields', status: 'failed' },
                        },
                    },
                },
                NotFound: {
                    description: 'Cheez nahi mili',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ErrorResponse' },
                            example: { message: 'Account not found for this user', status: 'failed' },
                        },
                    },
                },
            },
            // Reusable data shapes (request/response bodies)
            schemas: {
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                        status: { type: 'string', example: 'failed' },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: '665f1c2e9b1e8a0012a4b123' },
                        name: { type: 'string', example: 'Rishabh' },
                        email: { type: 'string', example: 'rishabh@example.com' },
                    },
                },
                Account: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '665f1c2e9b1e8a0012a4b999' },
                        user: { type: 'string', example: '665f1c2e9b1e8a0012a4b123' },
                        status: { type: 'string', enum: ['ACTIVE', 'FROZEN', 'CLOSED'], example: 'ACTIVE' },
                        currency: { type: 'string', example: 'INR' },
                    },
                },
                Transaction: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        fromAccount: { type: 'string' },
                        toAccount: { type: 'string' },
                        amount: { type: 'number', example: 100 },
                        status: {
                            type: 'string',
                            enum: ['PENDING', 'COMPLETED', 'FAILED', 'REVERTED'],
                            example: 'COMPLETED',
                        },
                        idempotencyKey: { type: 'string', example: 'txn-2026-0001' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
    },
    // In files ke `@openapi` comments scan honge. __dirname se absolute path banaya,
    // taaki server kisi bhi folder se start ho, files mil jaayein.
    apis: [path.join(__dirname, '../routes/*.js')],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
