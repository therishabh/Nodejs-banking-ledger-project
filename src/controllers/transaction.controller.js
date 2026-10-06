const mongoose = require('mongoose');
const transactionModel = require('../models/transaction.model');
const ledgerModel = require('../models/ledger.model');
const accountModel = require('../models/account.model');

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

        /**
         * 1. Validate the request
         * Check if all required fields (fromAccount, toAccount, amount, idempotencyKey) are present in the request body.
         * If any of these fields are missing, return a 400 error response with a message indicating the missing fields.
         */
        // Request body se transaction ki details nikaalo (body na ho to empty object)
        const { fromAccount, toAccount, amount, idempotencyKey } = req.body ?? {};

        // Saare required fields hone zaroori hain, warna 400 bhej do
        if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
            return res.status(400).json({
                message: 'Missing required fields (fromAccount, toAccount, amount, idempotencyKey)',
                status: 'failed',
            });
        }

        /** 
         * 2. Validate idempotency key
         * Check if a transaction with the same idempotencyKey already exists in the database.
         * If it does, return a 409 error response with a message indicating that the transaction already exists.
         */

        const isTransactionExists = await transactionModel.findOne({ idempotencyKey: idempotencyKey });
        if (isTransactionExists) {
            if (isTransactionExists.status === 'COMPLETED') {
                return res.status(200).json({
                    message: 'Transaction with the same idempotency key already exists and is completed',
                    status: 'success',
                });
            }

            // Abhi process ho rahi hai -> 202 Accepted, final result nahi hai isliye status 'pending'
            if (isTransactionExists.status === 'PENDING') {
                return res.status(202).json({
                    message: 'Transaction with the same idempotency key already exists and is pending',
                    status: 'pending',
                });
            }

            // Pehle fail ho chuki hai -> success nahi bol sakte, 409 + status 'failed'
            if (isTransactionExists.status === 'FAILED') {
                return res.status(409).json({
                    message: 'Transaction with the same idempotency key already exists and has failed',
                    status: 'failed',
                });
            }

            // Revert ho chuki hai -> 409 + status 'failed'
            if (isTransactionExists.status === 'REVERTED') {
                return res.status(409).json({
                    message: 'Transaction with the same idempotency key already exists and has been reverted',
                    status: 'failed',
                });
            }

            return res.status(409).json({
                message: 'Transaction with the same idempotency key already exists',
                status: 'failed',
            });
        }

        /**
         * 3. Fetch the sender and receiver accounts from the database using their IDs
         */
        // DB se sender aur receiver dono accounts fetch karo
        const fromAccountDoc = await accountModel.findById(fromAccount);
        const toAccountDoc = await accountModel.findById(toAccount);

        // Dono me se koi bhi account nahi mila to 400 bhej do
        if (!fromAccountDoc || !toAccountDoc) {
            return res.status(400).json({
                message: 'One or both accounts not found',
                status: 'failed',
            });
        }

        /**
         * 4. Check account status
         * Check if both the sender and receiver accounts are frozen.
         * 
         */
        if (fromAccountDoc.status !== 'ACTIVE' || toAccountDoc.status !== 'ACTIVE') {
            return res.status(400).json({
                message: 'One or both accounts are not active',
                status: 'failed',
            });
        }

        /**
         * 5. Derive sender balance from the ledger collection
         * Check if the sender account has sufficient balance to complete the transaction.
         * If the balance is insufficient, return a 400 error response with a message indicating insufficient funds.
         */
        const senderAccountBalance = await fromAccountDoc.getBalance();
        if (senderAccountBalance < amount) {
            return res.status(400).json({
                message: `Insufficient balance in sender account, current balance: ${senderAccountBalance} and required amount: ${amount}`,
                status: 'failed',
            });
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

    } catch (error) {
        // Beech me kuch fail hua to ab tak ke saare writes rollback karo (partial data na bache)
        if (session?.inTransaction()) {
            await session.abortTransaction();
        }

        res.status(500).json({
            message: 'Failed to create transaction',
            status: 'failed',
            error: error.message,
        });
    } finally {
        // Success ho ya error, session hamesha release karo
        session?.endSession();
    }
}


module.exports = {
    createTransactionController,
}