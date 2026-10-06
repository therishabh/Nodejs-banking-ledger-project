const mongoose = require('mongoose');
const transactionModel = require('../models/transaction.model');
const ledgerModel = require('../models/ledger.model');
const accountModel = require('../models/account.model');
const { sendResponse } = require('../utils/response');
const userModel = require('../models/user.model');

/**
 * - Create a new transaction
 * There are 11 Steps for Transaction Flow: 
 * 1. Validate the request
 * 2. Validate idempotency key
 * 3. Fetch the sender and receiver accounts from the database using their IDs
 * 4. Check account status
 * 5. Derive sender balance from the ledger collection
 * 6. create transaction in transaction collection with status PENDING
 * 7. Create DEBIT ledger entry for the sender account 
 * 8. Create CREDIT ledger entry for the receiver account
 * 9. Update the transaction status to COMPLETED
 * 10. Return a success response with the transaction details
 * 11. Handle any errors that occur during the process and return an appropriate error response
 */
async function createTransactionController(req, res) {
    // try ke bahar declare kiya taaki catch/finally me bhi abort/endSession kar sakein
    let session = null;

    try {
        const currentUser = req.user;

        const currentUserAccount = await accountModel.findOne({
            user: currentUser._id
        });

        const fromAccount = currentUserAccount._id;

        /**
         * 1. Validate the request
         * Check if all required fields (fromAccount, toAccount, amount, idempotencyKey) are present in the request body.
         * If any of these fields are missing, return a 400 error response with a message indicating the missing fields.
         */
        // Request body se transaction ki details nikaalo (body na ho to empty object)
        const { toAccount, amount, idempotencyKey } = req.body ?? {};

        // Saare required fields hone zaroori hain, warna 400 bhej do
        if (!toAccount || !amount || !idempotencyKey) {
            return sendResponse(res, 400, 'Missing required fields ( toAccount, amount, idempotencyKey)');
        }

        /** 
         * 2. Validate idempotency key
         * Check if a transaction with the same idempotencyKey already exists in the database.
         * If it does, return a 409 error response with a message indicating that the transaction already exists.
         */

        const isTransactionExists = await transactionModel.findOne({ idempotencyKey: idempotencyKey });
        if (isTransactionExists) {
            if (isTransactionExists.status === 'COMPLETED') {
                return sendResponse(res, 200, 'Transaction with the same idempotency key already exists and is completed');
            }

            // Abhi process ho rahi hai -> 202 Accepted, final result nahi hai isliye status 'pending'
            if (isTransactionExists.status === 'PENDING') {
                return sendResponse(res, 202, 'Transaction with the same idempotency key already exists and is pending', {
                    status: 'pending',
                });
            }

            // Pehle fail ho chuki hai -> success nahi bol sakte, 409 + status 'failed'
            if (isTransactionExists.status === 'FAILED') {
                return sendResponse(res, 409, 'Transaction with the same idempotency key already exists and has failed');
            }

            // Revert ho chuki hai -> 409 + status 'failed'
            if (isTransactionExists.status === 'REVERTED') {
                return sendResponse(res, 409, 'Transaction with the same idempotency key already exists and has been reverted');
            }

            return sendResponse(res, 409, 'Transaction with the same idempotency key already exists');
        }

        /**
         * 3. Fetch the sender and receiver accounts from the database using their IDs
         */
        // DB se sender aur receiver dono accounts fetch karo
        const fromAccountDoc = await accountModel.findById(fromAccount);
        const toAccountDoc = await accountModel.findById(toAccount);

        // Dono me se koi bhi account nahi mila to 400 bhej do
        if (!fromAccountDoc || !toAccountDoc) {
            return sendResponse(res, 400, 'One or both accounts not found');
        }

        /**
         * 4. Check account status
         * Check if both the sender and receiver accounts are frozen.
         * 
         */
        if (fromAccountDoc.status !== 'ACTIVE' || toAccountDoc.status !== 'ACTIVE') {
            return sendResponse(res, 400, 'One or both accounts are not active');
        }

        /**
         * 5. Derive sender balance from the ledger collection
         * Check if the sender account has sufficient balance to complete the transaction.
         * If the balance is insufficient, return a 400 error response with a message indicating insufficient funds.
         */
        const senderAccountBalance = await fromAccountDoc.getBalance();
        if (senderAccountBalance < amount) {
            return sendResponse(res, 400, `Insufficient balance in sender account, current balance: ${senderAccountBalance} and required amount: ${amount}`);
        }

        /**
         * 6. Create the transaction + ledger entries atomically (MongoDB session)
         * Saare writes ek hi session/transaction me hote hain, taaki ya to sab save ho
         * ya kuch bhi nahi (partial debit/credit se balance kharab na ho).
         * Flow:
         *   a. Transaction doc banao with status PENDING (in progress, abhi complete nahi)
         *   b. Sender ke account me DEBIT ledger entry
         *   c. Receiver ke account me CREDIT ledger entry
         *   d. Transaction status COMPLETED karke save karo
         *   e. commitTransaction() -> sab changes ek saath permanent
         */

        // Session start karo aur usme transaction begin karo
        session = await mongoose.startSession();
        session.startTransaction();

        // (a) PENDING transaction record - idempotencyKey se duplicate request detect hoti hai
        // Note: session option tabhi lagta hai jab create() ko array pass karo, isliye [ { ... } ]
        const [transaction] = await transactionModel.create([{
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: 'PENDING',
        }], { session });

        // (b) DEBIT entry: sender ke account se amount minus
        await ledgerModel.create([{
            account: fromAccount,
            transaction: transaction._id,
            type: 'DEBIT',
            amount: amount,
        }], { session });

        // (c) CREDIT entry: receiver ke account me same amount plus
        await ledgerModel.create([{
            account: toAccount,
            transaction: transaction._id,
            type: 'CREDIT',
            amount: amount,
        }], { session });

        // (d) Dono ledger entries ban gayi, ab transaction ko COMPLETED mark karo
        transaction.status = 'COMPLETED';
        await transaction.save({ session });

        // (e) Commit: yahin pe saare changes DB me permanent hote hain
        await session.commitTransaction();

        /**
         * 10. Return a success response with the transaction details
         * 201 Created: nayi transaction ban gayi aur COMPLETED ho chuki hai.
         */
        return sendResponse(res, 201, 'Transaction completed successfully', { transaction });
    } catch (error) {
        // Beech me kuch fail hua to ab tak ke saare writes rollback karo (partial data na bache)
        if (session?.inTransaction()) {
            await session.abortTransaction();
        }

        sendResponse(res, 500, 'Failed to create transaction', { error: error.message });
    } finally {
        // Success ho ya error, session hamesha release karo
        session?.endSession();
    }
}


async function createInitialFundsTransactionController(req, res) {

    // try ke bahar declare kiya taaki catch/finally me bhi abort/endSession kar sakein
    let session = null;

    try {
        const { toAccount, amount, idempotencyKey } = req.body;

        // Saare required fields hone zaroori hain, warna 400 bhej do
        if (!toAccount || !amount || !idempotencyKey) {
            return sendResponse(res, 400, 'Missing required fields (toAccount, amount, idempotencyKey)');
        }

        const toUserAccount = await accountModel.findById(toAccount);

        if (!toUserAccount) {
            return sendResponse(res, 400, 'Invalid Account');
        }

        // toAccount system user ka nahi hona chahiye.
        // `systemUser` me select:false hai, isliye .select('+systemUser') zaroori hai warna ye field aata hi nahi.
        const toUser = await userModel.findById(toUserAccount.user).select('+systemUser');

        if (toUser?.systemUser) {
            return sendResponse(res, 400, 'toAccount should not be system account');
        }

        // `systemUser` flag user model me hai (account me nahi). systemUserAuthMiddleware pehle hi
        // verify kar chuka hai ki req.user system user hai, isliye yahan sirf uska account dhoondhna hai.
        const fromUserAccount = await accountModel.findOne({
            user: req.user._id,
            status: 'ACTIVE',
        });

        if (!fromUserAccount) {
            return sendResponse(res, 400, 'Active account not found for system user');
        }

        const isTransactionExists = await transactionModel.findOne({ idempotencyKey: idempotencyKey });
        if (isTransactionExists) {
            if (isTransactionExists.status === 'COMPLETED') {
                return sendResponse(res, 200, 'Transaction with the same idempotency key already exists and is completed');
            }

            // Abhi process ho rahi hai -> 202 Accepted, final result nahi hai isliye status 'pending'
            if (isTransactionExists.status === 'PENDING') {
                return sendResponse(res, 202, 'Transaction with the same idempotency key already exists and is pending', {
                    status: 'pending',
                });
            }

            // Pehle fail ho chuki hai -> success nahi bol sakte, 409 + status 'failed'
            if (isTransactionExists.status === 'FAILED') {
                return sendResponse(res, 409, 'Transaction with the same idempotency key already exists and has failed');
            }

            // Revert ho chuki hai -> 409 + status 'failed'
            if (isTransactionExists.status === 'REVERTED') {
                return sendResponse(res, 409, 'Transaction with the same idempotency key already exists and has been reverted');
            }

            return sendResponse(res, 409, 'Transaction with the same idempotency key already exists');
        }

        session = await mongoose.startSession();
        session.startTransaction();

        const [transaction] = await transactionModel.create([{
            fromAccount: fromUserAccount._id,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        }], { session });

        await ledgerModel.create([{
            type: "DEBIT",
            transaction: transaction._id,
            account: fromUserAccount._id,
            amount
        }], { session });

        await ledgerModel.create([{
            type: "CREDIT",
            transaction: transaction._id,
            account: toAccount,
            amount
        }], { session });

        transaction.status = 'COMPLETED';
        await transaction.save({ session });

        // (e) Commit: yahin pe saare changes DB me permanent hote hain
        await session.commitTransaction();

        // Initial funds credit ho gaye -> 201 Created + transaction details
        return sendResponse(res, 201, 'Initial funds transaction completed successfully', { transaction });
    } catch (error) {
        // Beech me kuch fail hua to ab tak ke saare writes rollback karo (partial data na bache)
        if (session?.inTransaction()) {
            await session.abortTransaction();
        }

        sendResponse(res, 500, 'Failed to create transaction', { error: error.message });
    } finally {
        // Success ho ya error, session hamesha release karo
        session?.endSession();
    }
}

module.exports = {
    createTransactionController,
    createInitialFundsTransactionController,
}