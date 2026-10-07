const express = require('express');
const { authMiddleware, systemUserAuthMiddleware } = require('../middleware/auth.middleware');
const { createTransactionController, createInitialFundsTransactionController } = require('../controllers/transaction.controller');


const Router = express.Router();

/**
 * @openapi
 * /api/transactions:
 *   post:
 *     tags: [Transactions]
 *     summary: Apne account se kisi aur account me paisa bhejo
 *     description: |
 *       Sender ka account logged in user se apne aap nikalta hai (body me nahi dena).
 *       `idempotencyKey` har transfer ke liye unique rakho. Same key se dobara request aayi to naya transfer nahi banta.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toAccount, amount, idempotencyKey]
 *             properties:
 *               toAccount: { type: string, description: Receiver ki account id, example: 665f1c2e9b1e8a0012a4b999 }
 *               amount: { type: number, minimum: 0.01, example: 40 }
 *               idempotencyKey: { type: string, example: txn-2026-0001 }
 *     responses:
 *       201:
 *         description: Transfer complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 status: { type: string, example: success }
 *                 transaction: { $ref: '#/components/schemas/Transaction' }
 *       200:
 *         description: Same idempotencyKey wali transaction pehle hi COMPLETED hai
 *       202:
 *         description: Same idempotencyKey wali transaction abhi PENDING hai (status `pending`)
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Same idempotencyKey wali transaction FAILED / REVERTED hai, ya duplicate key
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
Router.post("/", authMiddleware, createTransactionController);

/**
 * @openapi
 * /api/transactions/system/initial-funds:
 *   post:
 *     tags: [Transactions]
 *     summary: "[System user only] Kisi account me initial funds daalo"
 *     description: |
 *       Sirf system user (bank) chala sakta hai. System user ke account se `toAccount` me paisa jaata hai.
 *       `toAccount` kisi system user ka nahi hona chahiye.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toAccount, amount, idempotencyKey]
 *             properties:
 *               toAccount: { type: string, example: 665f1c2e9b1e8a0012a4b999 }
 *               amount: { type: number, minimum: 0.01, example: 1000 }
 *               idempotencyKey: { type: string, example: funds-2026-0001 }
 *     responses:
 *       201:
 *         description: Funds credit ho gaye
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 status: { type: string, example: success }
 *                 transaction: { $ref: '#/components/schemas/Transaction' }
 *       200:
 *         description: Same idempotencyKey wali transaction pehle hi COMPLETED hai
 *       202:
 *         description: Same idempotencyKey wali transaction abhi PENDING hai
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Token galat hai ya user system user nahi hai
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: Unauthorized access, token is invalid or user is not a system user, status: failed }
 *       409:
 *         description: Same idempotencyKey wali transaction FAILED / REVERTED hai
 */
Router.post("/system/initial-funds", systemUserAuthMiddleware, createInitialFundsTransactionController);



module.exports = Router;
