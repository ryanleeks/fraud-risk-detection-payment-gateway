const { body, validationResult } = require('express-validator');
const database = require('../../../shared/database/postgres');
const { generateToken } = require('../../../shared/middleware/auth');
const ResponseHandler = require('../../../shared/utils/responseHandler');
const Logger = require('../../../shared/utils/logger');
const { sendVerificationEmail } = require('../utils/emailService');

const logger = new Logger('twofa-controller');

/**
 * Verify 2FA code
 */
exports.verify2FA = [
  body('userId').isInt().withMessage('Valid user ID is required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const { userId, code } = req.body;

      // Find valid verification code
      const result = await database.query(
        `SELECT vc.id, vc.user_id, vc.code, vc.expires_at,
         u.account_id, u.full_name, u.email, u.phone_number, u.twofa_enabled
         FROM verification_codes vc
         JOIN users u ON vc.user_id = u.id
         WHERE vc.user_id = $1 AND vc.code = $2 AND vc.used = FALSE
         AND vc.expires_at > NOW()
         ORDER BY vc.created_at DESC
         LIMIT 1`,
        [userId, code]
      );

      if (result.rows.length === 0) {
        return ResponseHandler.error(res, 'Invalid or expired verification code', 401);
      }

      const verification = result.rows[0];

      // Mark code as used
      await database.query(
        'UPDATE verification_codes SET used = TRUE, used_at = NOW() WHERE id = $1',
        [verification.id]
      );

      // Generate JWT token
      const token = generateToken({
        userId: verification.user_id,
        email: verification.email,
        accountId: verification.account_id
      });

      // Create audit log
      await database.query(
        `INSERT INTO audit_logs (service_name, user_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['auth-service', verification.user_id, '2fa_verified', 'user', verification.user_id, req.ip]
      );

      logger.info('2FA verification successful', { userId: verification.user_id });

      return ResponseHandler.success(res, {
        user: {
          id: verification.user_id,
          accountId: verification.account_id,
          fullName: verification.full_name,
          email: verification.email,
          phoneNumber: verification.phone_number,
          twoFAEnabled: verification.twofa_enabled
        },
        token
      }, '2FA verification successful');

    } catch (error) {
      logger.error('2FA verification error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Send 2FA code (generic)
 */
exports.sendCode = [
  body('userId').isInt().withMessage('Valid user ID is required'),
  body('purpose').isIn(['login', 'transaction', 'settings']).withMessage('Valid purpose is required'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const { userId, purpose } = req.body;

      // Get user info
      const result = await database.query(
        'SELECT id, email, twofa_method, twofa_enabled FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return ResponseHandler.notFound(res, 'User not found');
      }

      const user = result.rows[0];

      if (!user.twofa_enabled) {
        return ResponseHandler.error(res, '2FA is not enabled for this user', 400);
      }

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store verification code
      await database.query(
        `INSERT INTO verification_codes (user_id, code, purpose, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, code, purpose, expiresAt]
      );

      // Send verification code
      if (user.twofa_method === 'email') {
        await sendVerificationEmail(user.email, code, 'Verification Code');
      }
      // TODO: Implement SMS sending

      logger.info('2FA code sent', { userId, purpose, method: user.twofa_method });

      return ResponseHandler.success(res, {
        method: user.twofa_method,
        expiresIn: 600 // seconds
      }, 'Verification code sent');

    } catch (error) {
      logger.error('Send 2FA code error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Send disable 2FA code
 */
exports.sendDisableCode = [
  body('userId').isInt().withMessage('Valid user ID is required'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const { userId } = req.body;

      // Get user info
      const result = await database.query(
        'SELECT id, email, full_name, twofa_method, twofa_enabled FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return ResponseHandler.notFound(res, 'User not found');
      }

      const user = result.rows[0];

      if (!user.twofa_enabled) {
        return ResponseHandler.error(res, '2FA is already disabled', 400);
      }

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store verification code
      await database.query(
        `INSERT INTO verification_codes (user_id, code, purpose, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, code, 'disable_2fa', expiresAt]
      );

      // Send verification code
      if (user.twofa_method === 'email') {
        await sendVerificationEmail(
          user.email,
          code,
          '2FA Disable Request',
          `Hello ${user.full_name},\n\nYou requested to disable Two-Factor Authentication.\nYour verification code is: ${code}\n\nThis code will expire in 10 minutes.`
        );
      }

      logger.info('Disable 2FA code sent', { userId, method: user.twofa_method });

      return ResponseHandler.success(res, {
        method: user.twofa_method
      }, 'Verification code sent to disable 2FA');

    } catch (error) {
      logger.error('Send disable 2FA code error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];
