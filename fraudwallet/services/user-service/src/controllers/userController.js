const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const database = require('../../../shared/database/postgres');
const ResponseHandler = require('../../../shared/utils/responseHandler');
const Logger = require('../../../shared/utils/logger');

const logger = new Logger('user-controller');

/**
 * Toggle 2FA on/off
 */
exports.toggle2FA = [
  body('enable').isBoolean().withMessage('Enable must be true or false'),
  body('otpCode').optional().isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code required'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const userId = req.user.id;
      const { enable, otpCode } = req.body;

      // If disabling 2FA, verify OTP code
      if (!enable && otpCode) {
        const verification = await database.query(
          `SELECT id FROM verification_codes
           WHERE user_id = $1 AND code = $2 AND purpose = 'disable_2fa'
           AND used = FALSE AND expires_at > NOW()
           ORDER BY created_at DESC LIMIT 1`,
          [userId, otpCode]
        );

        if (verification.rows.length === 0) {
          return ResponseHandler.error(res, 'Invalid or expired verification code', 401);
        }

        // Mark code as used
        await database.query(
          'UPDATE verification_codes SET used = TRUE, used_at = NOW() WHERE id = $1',
          [verification.rows[0].id]
        );
      }

      // Update 2FA status
      const result = await database.query(
        `UPDATE users
         SET twofa_enabled = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, twofa_enabled, twofa_method`,
        [enable, userId]
      );

      // Audit log
      await database.query(
        `INSERT INTO audit_logs (service_name, user_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['user-service', userId, enable ? '2fa_enabled' : '2fa_disabled', 'user', userId, req.ip]
      );

      logger.info(`2FA ${enable ? 'enabled' : 'disabled'}`, { userId });

      return ResponseHandler.success(res, {
        twoFAEnabled: result.rows[0].twofa_enabled,
        twoFAMethod: result.rows[0].twofa_method
      }, `2FA ${enable ? 'enabled' : 'disabled'} successfully`);

    } catch (error) {
      logger.error('Toggle 2FA error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Update 2FA method
 */
exports.update2FAMethod = [
  body('method').isIn(['email', 'sms']).withMessage('Method must be email or sms'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const userId = req.user.id;
      const { method } = req.body;

      const result = await database.query(
        `UPDATE users
         SET twofa_method = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, twofa_method`,
        [method, userId]
      );

      logger.info('2FA method updated', { userId, method });

      return ResponseHandler.success(res, {
        twoFAMethod: result.rows[0].twofa_method
      }, '2FA method updated successfully');

    } catch (error) {
      logger.error('Update 2FA method error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Send test 2FA code
 */
exports.send2FATest = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user info
    const result = await database.query(
      'SELECT id, email, phone_number, twofa_method FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return ResponseHandler.notFound(res, 'User not found');
    }

    const user = result.rows[0];

    // Generate test code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store code
    await database.query(
      `INSERT INTO verification_codes (user_id, code, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, code, 'test', expiresAt]
    );

    logger.info('Test 2FA code sent', { userId, method: user.twofa_method });

    return ResponseHandler.success(res, {
      method: user.twofa_method,
      destination: user.twofa_method === 'email' ? user.email : user.phone_number
    }, 'Test code sent successfully');

  } catch (error) {
    logger.error('Send test 2FA error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Lookup recipient for payment
 */
exports.lookupRecipient = [
  body('identifier').optional().trim().notEmpty().withMessage('Email, phone, or Account ID is required'),
  body('query').optional().trim().notEmpty().withMessage('Email, phone, or Account ID is required'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      // Accept both 'identifier' and 'query' parameters for compatibility
      const { identifier, query } = req.body;
      const searchTerm = identifier || query;

      if (!searchTerm) {
        return ResponseHandler.error(res, 'Email, phone, or Account ID is required', 400);
      }

      // Search by email, phone, or account ID
      const result = await database.query(
        `SELECT id, account_id, full_name, email, phone_number
         FROM users
         WHERE (email = $1 OR phone_number = $1 OR account_id = $1)
         AND account_status = 'active'`,
        [searchTerm]
      );

      if (result.rows.length === 0) {
        return ResponseHandler.notFound(res, 'Recipient not found');
      }

      const recipient = result.rows[0];

      logger.info('Recipient lookup', { searchTerm, foundUserId: recipient.id });

      return ResponseHandler.success(res, {
        recipient: {
          id: recipient.id,
          accountId: recipient.account_id,
          fullName: recipient.full_name,
          email: recipient.email,
          phoneNumber: recipient.phone_number
        }
      }, 'Recipient found');

    } catch (error) {
      logger.error('Lookup recipient error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Generate QR code for user's account
 */
exports.generateQRCode = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user account ID
    const result = await database.query(
      'SELECT account_id, full_name FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return ResponseHandler.notFound(res, 'User not found');
    }

    const user = result.rows[0];

    // Generate QR code data
    const qrData = JSON.stringify({
      type: 'fraudwallet_payment',
      accountId: user.account_id,
      name: user.full_name
    });

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    logger.info('QR code generated', { userId });

    return ResponseHandler.success(res, {
      qrCode: qrCodeDataURL,
      accountId: user.account_id,
      name: user.full_name
    }, 'QR code generated successfully');

  } catch (error) {
    logger.error('Generate QR code error', error);
    return ResponseHandler.serverError(res, error);
  }
};
