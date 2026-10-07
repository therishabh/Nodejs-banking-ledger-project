const express = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { getMeController } = require('../controllers/user.controller');

const router = express.Router();

/**
 * @openapi
 * /api/me:
 *   get:
 *     tags: [User]
 *     summary: Logged in user ki info
 *     description: User ki details aur uska account (account na bana ho to `null`).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 status: { type: string, example: success }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     email: { type: string }
 *                     role: { type: string, example: user }
 *                     isActive: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *                 account:
 *                   nullable: true
 *                   type: object
 *                   properties:
 *                     accountId: { type: string }
 *                     status: { type: string, example: ACTIVE }
 *                     currency: { type: string, example: INR }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', authMiddleware, getMeController);

module.exports = router;
