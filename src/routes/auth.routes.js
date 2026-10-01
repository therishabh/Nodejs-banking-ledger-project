const express = require('express');
const { userRegisterController } = require('../controllers/auth.controller');

const router = express.Router();

// POST /api/auth/register
router.post('/register', userRegisterController);

module.exports = router;