const express = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { createTransactionController } = require('../controllers/transaction.controller');


const Router = express.Router();

/**
 * - POST api/transactions
 * - Create a new transaction
 * - protected route
 */
Router.post("/", authMiddleware, createTransactionController);

module.exports = Router;