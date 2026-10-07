const express = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const {
    createAccountController,
    listAccountController,
    getBalanceController,
} = require('../controllers/account.controller');

const router = express.Router();

/**
 * @openapi
 * /api/accounts:
 *   post:
 *     tags: [Accounts]
 *     summary: Apna account banao
 *     description: Ek user ka ek hi account ban sakta hai. Body optional hai (default currency INR, status ACTIVE).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currency: { type: string, example: INR }
 *               status: { type: string, enum: [ACTIVE, FROZEN, CLOSED], example: ACTIVE }
 *     responses:
 *       201:
 *         description: Account ban gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 status: { type: string, example: success }
 *                 account: { $ref: '#/components/schemas/Account' }
 *       400:
 *         description: Account pehle se bana hua hai
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: Account already created, status: failed }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', authMiddleware, createAccountController);

/**
 * @openapi
 * /api/accounts:
 *   get:
 *     tags: [Accounts]
 *     summary: Saare ACTIVE accounts ki list
 *     description: Account id + user ka name. Apna account aur system users ke accounts list me nahi aate (transfer ke liye receiver chunne me kaam aati hai).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Accounts ki list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 status: { type: string, example: success }
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       accountId: { type: string }
 *                       name: { type: string, example: Bob }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', authMiddleware, listAccountController);

/**
 * @openapi
 * /api/accounts/balance:
 *   get:
 *     tags: [Accounts]
 *     summary: Apne account ka balance
 *     description: Balance ledger se nikalta hai (total CREDIT minus total DEBIT).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 status: { type: string, example: success }
 *                 accountId: { type: string }
 *                 balance: { type: number, example: 150 }
 *                 currency: { type: string, example: INR }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/balance', authMiddleware, getBalanceController);

module.exports = router;
