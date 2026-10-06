const express = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const {
    createAccountController,
    listAccountController,
} = require('../controllers/account.controller');

const router = express.Router();

/**
 * - POST api/accounts
 * - Create a new account
 * - protected route
 */
router.post('/', authMiddleware, createAccountController);
router.get('/', authMiddleware, listAccountController);

module.exports = router;
