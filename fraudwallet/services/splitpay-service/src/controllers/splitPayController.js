const { body, validationResult } = require('express-validator');
const axios = require('axios');
const database = require('../../../shared/database/postgres');
const ResponseHandler = require('../../../shared/utils/responseHandler');
const Logger = require('../../../shared/utils/logger');

const logger = new Logger('splitpay-controller');
const WALLET_SERVICE = process.env.WALLET_SERVICE || 'http://wallet-service:3003';

exports.createSplitPayment = [
  body('title').trim().notEmpty(),
  body('description').optional().trim(),
  body('totalAmount').isFloat({ min: 0.01 }),
  body('participantIds').isArray({ min: 1 }),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const creatorId = req.user.id;
      const { title, description, totalAmount, participantIds } = req.body;

      const numParticipants = participantIds.length + 1; // +1 for creator
      const amountPerPerson = Math.round((totalAmount / numParticipants) * 100) / 100;

      const client = await database.getClient();

      try {
        await client.query('BEGIN');

        const splitResult = await client.query(
          `INSERT INTO split_payments (creator_id, title, description, total_amount, num_participants, amount_per_person, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'active')
           RETURNING id, created_at`,
          [creatorId, title, description, totalAmount, numParticipants, amountPerPerson]
        );

        const splitId = splitResult.rows[0].id;

        // Add creator as accepted participant
        await client.query(
          `INSERT INTO split_participants (split_payment_id, user_id, status)
           VALUES ($1, $2, 'accepted')`,
          [splitId, creatorId]
        );

        // Add other participants
        for (const participantId of participantIds) {
          await client.query(
            `INSERT INTO split_participants (split_payment_id, user_id, status)
             VALUES ($1, $2, 'pending')`,
            [splitId, participantId]
          );
        }

        await client.query('COMMIT');

        logger.info('Split payment created', { splitId, creatorId, numParticipants });

        return ResponseHandler.success(res, {
          splitId,
          amountPerPerson,
          createdAt: splitResult.rows[0].created_at
        }, 'Split payment created', 201);

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Create split payment error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

exports.getMySplitPayments = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await database.query(
      `SELECT
        sp.id,
        sp.title,
        sp.description,
        sp.total_amount,
        sp.amount_per_person,
        sp.status as split_status,
        sp.created_at,
        u.full_name as creator_name,
        spp.status as my_status,
        spp.paid as my_paid
       FROM split_payments sp
       JOIN users u ON sp.creator_id = u.id
       JOIN split_participants spp ON sp.id = spp.split_payment_id
       WHERE spp.user_id = $1
       ORDER BY sp.created_at DESC`,
      [userId]
    );

    const splits = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      totalAmount: parseFloat(row.total_amount),
      amountPerPerson: parseFloat(row.amount_per_person),
      splitStatus: row.split_status,
      creatorName: row.creator_name,
      myStatus: row.my_status,
      myPaid: row.my_paid,
      createdAt: row.created_at
    }));

    return ResponseHandler.success(res, { splits });

  } catch (error) {
    logger.error('Get my splits error', error);
    return ResponseHandler.serverError(res, error);
  }
};

exports.respondToSplitPayment = [
  body('splitId').isInt(),
  body('accept').isBoolean(),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const userId = req.user.id;
      const { splitId, accept } = req.body;

      await database.query(
        `UPDATE split_participants
         SET status = $1, responded_at = NOW()
         WHERE split_payment_id = $2 AND user_id = $3`,
        [accept ? 'accepted' : 'rejected', splitId, userId]
      );

      logger.info('Split payment response', { splitId, userId, accept });

      return ResponseHandler.success(res, null, `Split payment ${accept ? 'accepted' : 'rejected'}`);

    } catch (error) {
      logger.error('Respond to split error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

exports.payMyShare = [
  body('splitId').isInt(),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const userId = req.user.id;
      const { splitId } = req.body;

      // Get split payment details
      const splitResult = await database.query(
        `SELECT sp.amount_per_person, sp.creator_id, sp.title
         FROM split_payments sp
         JOIN split_participants spp ON sp.id = spp.split_payment_id
         WHERE sp.id = $1 AND spp.user_id = $2 AND spp.status = 'accepted' AND spp.paid = FALSE`,
        [splitId, userId]
      );

      if (splitResult.rows.length === 0) {
        return ResponseHandler.error(res, 'Split payment not found or already paid', 404);
      }

      const amount = parseFloat(splitResult.rows[0].amount_per_person);
      const creatorId = splitResult.rows[0].creator_id;
      const title = splitResult.rows[0].title;

      // Deduct from participant
      try {
        await axios.post(`${WALLET_SERVICE}/api/wallet/internal/deduct`, {
          userId,
          amount,
          description: `Split payment: ${title}`,
          splitPaymentId: splitId
        });
      } catch (error) {
        logger.error('Wallet deduction failed', error);
        return ResponseHandler.error(res, 'Insufficient balance or wallet service error', 400);
      }

      // Credit to creator
      await axios.post(`${WALLET_SERVICE}/api/wallet/internal/credit`, {
        userId: creatorId,
        amount,
        description: `Split payment received: ${title}`
      });

      // Mark as paid
      await database.query(
        `UPDATE split_participants
         SET paid = TRUE, paid_at = NOW()
         WHERE split_payment_id = $1 AND user_id = $2`,
        [splitId, userId]
      );

      logger.info('Split payment paid', { splitId, userId, amount });

      return ResponseHandler.success(res, { amount }, 'Payment successful');

    } catch (error) {
      logger.error('Pay share error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

exports.cancelSplitPayment = [
  body('splitId').isInt(),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const userId = req.user.id;
      const { splitId } = req.body;

      // Only creator can cancel
      const result = await database.query(
        'UPDATE split_payments SET status = $1 WHERE id = $2 AND creator_id = $3 RETURNING id',
        ['cancelled', splitId, userId]
      );

      if (result.rows.length === 0) {
        return ResponseHandler.error(res, 'Split payment not found or unauthorized', 404);
      }

      logger.info('Split payment cancelled', { splitId, userId });

      return ResponseHandler.success(res, null, 'Split payment cancelled');

    } catch (error) {
      logger.error('Cancel split error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];
