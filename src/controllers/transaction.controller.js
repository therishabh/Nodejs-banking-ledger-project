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


    } catch (error) {
        res.status(500).json({
            message: 'Failed to create transaction',
            status: 'failed',
            error: error.message,
        });
    }
}


module.exports = {
    createTransactionController,
}