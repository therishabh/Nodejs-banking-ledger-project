const express = require('express');
const cookieParser = require('cookie-parser');
const authRouter = require('./routes/auth.routes');
const accountRouter = require('./routes/account.routes');
const transactionRouter = require('./routes/transaction.routes');
const userRouter = require('./routes/user.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

// Middleware: request body (JSON) ko parse karke `req.body` me daalta hai.
// Iske bina POST/PUT me bheja gaya JSON `req.body` me undefined aayega.
// Routes se PEHLE lagana zaroori hai, warna routes ko body nahi milegi.
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/accounts', accountRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/me', userRouter);

// Error handling: hamesha saare routes ke BAAD, aur is order me (pehle 404, phir global error handler)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
