const { body, validationResult } = require('express-validator');
const database = require('../../../shared/database/postgres');
const ResponseHandler = require('../../../shared/utils/responseHandler');
const Logger = require('../../../shared/utils/logger');

const logger = new Logger('profile-controller');

/**
 * Get user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await database.query(
      `SELECT id, account_id, full_name, email, phone_number, wallet_balance,
       twofa_enabled, twofa_method, account_status, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return ResponseHandler.notFound(res, 'User not found');
    }

    const user = result.rows[0];

    return ResponseHandler.success(res, {
      id: user.id,
      accountId: user.account_id,
      fullName: user.full_name,
      email: user.email,
      phoneNumber: user.phone_number,
      walletBalance: parseFloat(user.wallet_balance),
      twoFAEnabled: user.twofa_enabled,
      twoFAMethod: user.twofa_method,
      accountStatus: user.account_status,
      createdAt: user.created_at
    }, 'Profile retrieved successfully');

  } catch (error) {
    logger.error('Get profile error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Update user profile
 */
exports.updateProfile = [
  body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const userId = req.user.id;
      const { fullName } = req.body;

      // Update user
      const result = await database.query(
        `UPDATE users
         SET full_name = COALESCE($1, full_name),
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, account_id, full_name, email, phone_number`,
        [fullName, userId]
      );

      if (result.rows.length === 0) {
        return ResponseHandler.notFound(res, 'User not found');
      }

      const user = result.rows[0];

      // Audit log
      await database.query(
        `INSERT INTO audit_logs (service_name, user_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['user-service', userId, 'profile_updated', 'user', userId, req.ip]
      );

      logger.info('Profile updated', { userId });

      return ResponseHandler.success(res, {
        id: user.id,
        accountId: user.account_id,
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number
      }, 'Profile updated successfully');

    } catch (error) {
      logger.error('Update profile error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Change phone number
 */
exports.changePhoneNumber = [
  body('newPhoneNumber')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Valid phone number is required'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const userId = req.user.id;
      const { newPhoneNumber } = req.body;

      // Check if phone number already exists
      const existing = await database.query(
        'SELECT id FROM users WHERE phone_number = $1 AND id != $2',
        [newPhoneNumber, userId]
      );

      if (existing.rows.length > 0) {
        return ResponseHandler.error(res, 'Phone number already in use', 409);
      }

      // Update phone number
      const result = await database.query(
        `UPDATE users
         SET phone_number = $1,
             phone_last_changed = NOW(),
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, phone_number, phone_last_changed`,
        [newPhoneNumber, userId]
      );

      // Audit log
      await database.query(
        `INSERT INTO audit_logs (service_name, user_id, action, entity_type, entity_id, ip_address, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'user-service',
          userId,
          'phone_changed',
          'user',
          userId,
          req.ip,
          JSON.stringify({ newPhoneNumber })
        ]
      );

      logger.info('Phone number changed', { userId });

      return ResponseHandler.success(res, {
        phoneNumber: result.rows[0].phone_number,
        changedAt: result.rows[0].phone_last_changed
      }, 'Phone number updated successfully');

    } catch (error) {
      logger.error('Change phone error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Terminate account
 */
exports.terminateAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check wallet balance
    const userResult = await database.query(
      'SELECT wallet_balance FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return ResponseHandler.notFound(res, 'User not found');
    }

    const balance = parseFloat(userResult.rows[0].wallet_balance);

    if (balance > 0) {
      return ResponseHandler.error(
        res,
        `Cannot terminate account with remaining balance of RM${balance.toFixed(2)}`,
        400
      );
    }

    // Update account status
    await database.query(
      `UPDATE users
       SET account_status = 'terminated',
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    // Audit log
    await database.query(
      `INSERT INTO audit_logs (service_name, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['user-service', userId, 'account_terminated', 'user', userId, req.ip]
    );

    logger.info('Account terminated', { userId });

    return ResponseHandler.success(res, null, 'Account terminated successfully');

  } catch (error) {
    logger.error('Terminate account error', error);
    return ResponseHandler.serverError(res, error);
  }
};
