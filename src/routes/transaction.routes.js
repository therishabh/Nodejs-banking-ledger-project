const express = require('express');
const { authMiddleware, systemUserAuthMiddleware } = require('../middleware/auth.middleware');
const { createTransactionController, createInitialFundsTransactionController } = require('../controllers/transaction.controller');


const Router = express.Router();

/**
 * - POST api/transactions
 * - Create a new transaction
 * - protected route
 */
Router.post("/", authMiddleware, createTransactionController);
Router.post("/system/initial-funds", systemUserAuthMiddleware, createInitialFundsTransactionController);



module.exports = Router;