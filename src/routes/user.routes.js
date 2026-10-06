const express = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { getMeController } = require('../controllers/user.controller');

const router = express.Router();

/**
 * - GET api/me
 * - Logged in user ki info
 * - protected route
 */
router.get('/', authMiddleware, getMeController);

module.exports = router;
