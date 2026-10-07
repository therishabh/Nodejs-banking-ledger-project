const express = require('express');
const {
    userRegisterController,
    userLoginController,
    userLogoutController,
} = require('../controllers/auth.controller');

const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Naya user register karo
 *     description: User banata hai, JWT token deta hai (cookie `jwt_token` me bhi set hota hai) aur welcome email bhejta hai.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 50, example: Rishabh }
 *               email: { type: string, example: rishabh@example.com }
 *               password: { type: string, minLength: 8, example: password123 }
 *     responses:
 *       201:
 *         description: User ban gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: User has been successfully created }
 *                 status: { type: string, example: success }
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       422:
 *         description: Is email se user pehle se hai
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: User already exists with this email., status: failed }
 */
router.post('/register', userRegisterController);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login karo
 *     description: Sahi email/password par JWT token deta hai aur cookie `jwt_token` set karta hai.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: rishabh@example.com }
 *               password: { type: string, example: password123 }
 *     responses:
 *       200:
 *         description: Login ho gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: User has been successfully login }
 *                 status: { type: string, example: success }
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Email ya password galat
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: Email or password is not valid, status: failed }
 */
router.post('/login', userLoginController);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout karo
 *     description: Cookie `jwt_token` clear karta hai. Header se bheja gaya token expire hone tak valid rehta hai (JWT stateless hai).
 *     responses:
 *       200:
 *         description: Logout ho gaya
 *         content:
 *           application/json:
 *             example: { message: User logged out successfully, status: success }
 */
router.post('/logout', userLogoutController);

module.exports = router;
