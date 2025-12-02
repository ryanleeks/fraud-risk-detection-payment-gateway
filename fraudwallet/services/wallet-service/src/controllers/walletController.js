const { body, validationResult } = require('express-validator');
const database = require('../../../shared/database/postgres');
const ResponseHandler = require('../../../shared/utils/responseHandler');
const Logger = require('../../../shared/utils/logger');
const axios = require('axios');

const logger = new Logger('wallet-controller');

const FRAUD_DETECTION_SERVICE = process.env.FRAUD_DETECTION_SERVICE || 'http://fraud-detection-service:3005';

// Amount validation constants
const AMOUNT_LIMITS = {
  MIN: 0.01,
  MAX: 999999.99,
  MIN_TOPUP: 10.00
};

/**
 * Validate amount
 */
function validateAmount(amount, options = {}) {
  const numAmount = Math.round(parseFloat(amount) * 100) / 100;

  if (isNaN(numAmount)) {
    return { isValid: false, error: 'Invalid amount format' };
  }

  if (numAmount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }

  if (options.minTopup && numAmount < AMOUNT_LIMITS.MIN_TOPUP) {
    return { isValid: false, error: `Minimum top-up amount is RM ${AMOUNT_LIMITS.MIN_TOPUP.toFixed(2)}` };
  }

  if (numAmount > AMOUNT_LIMITS.MAX) {
    return { isValid: false, error: `Maximum amount is RM ${AMOUNT_LIMITS.MAX.toFixed(2)}` };
  }

  return { isValid: true, value: numAmount };
}

/**
 * Get wallet balance
 */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await database.query(
      'SELECT wallet_balance FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return ResponseHandler.notFound(res, 'User not found');
    }

    return ResponseHandler.success(res, {
      balance: parseFloat(result.rows[0].wallet_balance) || 0
    }, 'Balance retrieved successfully');

  } catch (error) {
    logger.error('Get balance error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Get transaction history
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await database.query(
      `SELECT
        t.id,
        t.type,
        t.amount,
        t.status,
        t.description,
        t.fraud_score,
        t.created_at,
        u.full_name as recipient_name,
        u.account_id as recipient_account_id
       FROM transactions t
       LEFT JOIN users u ON t.recipient_id = u.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const transactions = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      amount: parseFloat(row.amount),
      status: row.status,
      description: row.description,
      fraudScore: row.fraud_score ? parseFloat(row.fraud_score) : null,
      recipientName: row.recipient_name,
      recipientAccountId: row.recipient_account_id,
      createdAt: row.created_at
    }));

    return ResponseHandler.success(res, {
      transactions,
      pagination: {
        limit,
        offset,
        total: transactions.length
      }
    }, 'Transaction history retrieved');

  } catch (error) {
    logger.error('Get transaction history error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Send money to another user
 */
exports.sendMoney = [
  body('recipientId').isInt().withMessage('Valid recipient ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
  body('description').optional().trim(),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const senderId = req.user.id;
      const { recipientId, amount, description } = req.body;

      // Validate amount
      const validation = validateAmount(amount);
      if (!validation.isValid) {
        return ResponseHandler.error(res, validation.error, 400);
      }

      const validatedAmount = validation.value;

      // Check if sender and recipient are different
      if (senderId === recipientId) {
        return ResponseHandler.error(res, 'Cannot send money to yourself', 400);
      }

      // Get sender balance
      const senderResult = await database.query(
        'SELECT wallet_balance, full_name FROM users WHERE id = $1 AND account_status = $2',
        [senderId, 'active']
      );

      if (senderResult.rows.length === 0) {
        return ResponseHandler.error(res, 'Sender account not found or inactive', 404);
      }

      const senderBalance = parseFloat(senderResult.rows[0].wallet_balance);
      const senderName = senderResult.rows[0].full_name;

      // Check sufficient balance
      if (senderBalance < validatedAmount) {
        return ResponseHandler.error(res, 'Insufficient balance', 400);
      }

      // Get recipient info
      const recipientResult = await database.query(
        'SELECT id, full_name FROM users WHERE id = $1 AND account_status = $2',
        [recipientId, 'active']
      );

      if (recipientResult.rows.length === 0) {
        return ResponseHandler.error(res, 'Recipient not found or inactive', 404);
      }

      const recipientName = recipientResult.rows[0].full_name;

      // Fraud detection check
      let fraudScore = 0;
      let fraudFlags = null;

      try {
        const fraudResponse = await axios.post(`${FRAUD_DETECTION_SERVICE}/api/fraud/check-transaction`, {
          userId: senderId,
          type: 'send',
          amount: validatedAmount,
          recipientId
        }, { timeout: 3000 });

        fraudScore = fraudResponse.data.riskScore || 0;
        fraudFlags = fraudResponse.data.flags || null;

        logger.info('Fraud check completed', { userId: senderId, fraudScore });

      } catch (fraudError) {
        logger.warn('Fraud detection service unavailable, proceeding without check', fraudError.message);
        // Continue without fraud check if service is unavailable
      }

      // Block transaction if high risk
      if (fraudScore > 80) {
        logger.warn('Transaction blocked due to high fraud risk', { userId: senderId, fraudScore });
        return ResponseHandler.error(res, 'Transaction blocked due to security concerns', 403);
      }

      // Start database transaction
      const client = await database.getClient();

      try {
        await client.query('BEGIN');

        // Deduct from sender
        await client.query(
          'UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2',
          [validatedAmount, senderId]
        );

        // Add to recipient
        await client.query(
          'UPDATE users SET wallet_balance = wallet_balance + $1, updated_at = NOW() WHERE id = $2',
          [validatedAmount, recipientId]
        );

        // Record sender transaction
        const senderTxn = await client.query(
          `INSERT INTO transactions (user_id, type, amount, status, description, recipient_id, fraud_score, fraud_flags)
           VALUES ($1, 'send', $2, 'completed', $3, $4, $5, $6)
           RETURNING id, created_at`,
          [
            senderId,
            validatedAmount,
            description || `Sent to ${recipientName}`,
            recipientId,
            fraudScore,
            fraudFlags ? JSON.stringify(fraudFlags) : null
          ]
        );

        // Record recipient transaction
        await client.query(
          `INSERT INTO transactions (user_id, type, amount, status, description, recipient_id, fraud_score)
           VALUES ($1, 'receive', $2, 'completed', $3, $4, $5)`,
          [
            recipientId,
            validatedAmount,
            description || `Received from ${senderName}`,
            senderId,
            fraudScore
          ]
        );

        // Audit log
        await client.query(
          `INSERT INTO audit_logs (service_name, user_id, action, entity_type, entity_id, ip_address, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'wallet-service',
            senderId,
            'money_sent',
            'transaction',
            senderTxn.rows[0].id,
            req.ip,
            JSON.stringify({ recipientId, amount: validatedAmount, fraudScore })
          ]
        );

        await client.query('COMMIT');

        logger.info('Money sent successfully', {
          senderId,
          recipientId,
          amount: validatedAmount,
          fraudScore
        });

        return ResponseHandler.success(res, {
          transactionId: senderTxn.rows[0].id,
          amount: validatedAmount,
          recipient: recipientName,
          newBalance: senderBalance - validatedAmount,
          fraudScore,
          timestamp: senderTxn.rows[0].created_at
        }, 'Money sent successfully');

      } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Send money error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Internal API: Deduct funds (for split payments)
 */
exports.deductFunds = async (req, res) => {
  try {
    const { userId, amount, description, splitPaymentId } = req.body;

    const validation = validateAmount(amount);
    if (!validation.isValid) {
      return ResponseHandler.error(res, validation.error, 400);
    }

    const validatedAmount = validation.value;

    const client = await database.getClient();

    try {
      await client.query('BEGIN');

      // Check balance
      const userResult = await client.query(
        'SELECT wallet_balance FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const balance = parseFloat(userResult.rows[0].wallet_balance);

      if (balance < validatedAmount) {
        throw new Error('Insufficient balance');
      }

      // Deduct funds
      await client.query(
        'UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2',
        [validatedAmount, userId]
      );

      // Record transaction
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, status, description, split_payment_id)
         VALUES ($1, 'split_payment', $2, 'completed', $3, $4)`,
        [userId, validatedAmount, description, splitPaymentId]
      );

      await client.query('COMMIT');

      return ResponseHandler.success(res, { newBalance: balance - validatedAmount }, 'Funds deducted');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Deduct funds error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Internal API: Credit funds
 */
exports.creditFunds = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;

    const validation = validateAmount(amount);
    if (!validation.isValid) {
      return ResponseHandler.error(res, validation.error, 400);
    }

    const validatedAmount = validation.value;

    await database.query(
      'UPDATE users SET wallet_balance = wallet_balance + $1, updated_at = NOW() WHERE id = $2',
      [validatedAmount, userId]
    );

    await database.query(
      `INSERT INTO transactions (user_id, type, amount, status, description)
       VALUES ($1, 'refund', $2, 'completed', $3)`,
      [userId, validatedAmount, description]
    );

    return ResponseHandler.success(res, null, 'Funds credited');

  } catch (error) {
    logger.error('Credit funds error', error);
    return ResponseHandler.serverError(res, error);
  }
};
