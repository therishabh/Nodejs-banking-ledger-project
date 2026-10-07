const express = require('express');
const cookieParser = require('cookie-parser');
const authRouter = require('./routes/auth.routes');
const accountRouter = require('./routes/account.routes');
const transactionRouter = require('./routes/transaction.routes');
const userRouter = require('./routes/user.routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

// Middleware: request body (JSON) ko parse karke `req.body` me daalta hai.
// Iske bina POST/PUT me bheja gaya JSON `req.body` me undefined aayega.
// Routes se PEHLE lagana zaroori hai, warna routes ko body nahi milegi.
app.use(express.json());
app.use(cookieParser());

// API docs (Swagger UI): browser me http://localhost:9000/api-docs kholo
// persistAuthorization: Authorize me daala hua token page refresh ke baad bhi yaad rahe
app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, { swaggerOptions: { persistAuthorization: true } }),
);
// Raw OpenAPI spec (JSON). Postman jaise tools me import karne ke kaam aata hai
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/accounts', accountRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/me', userRouter);

// Error handling: hamesha saare routes ke BAAD, aur is order me (pehle 404, phir global error handler)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
