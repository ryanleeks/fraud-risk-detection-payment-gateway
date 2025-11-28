const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const database = require('../../../shared/database/postgres');
const { generateToken } = require('../../../shared/middleware/auth');
const ResponseHandler = require('../../../shared/utils/responseHandler');
const Logger = require('../../../shared/utils/logger');
const { sendVerificationEmail } = require('../utils/emailService');

const logger = new Logger('auth-controller');

/**
 * Generate a unique 12-digit Account ID
 */
async function generateUniqueAccountId() {
  let accountId;
  let isUnique = false;

  while (!isUnique) {
    // Generate 12 random digits
    accountId = '';
    for (let i = 0; i < 12; i++) {
      accountId += Math.floor(Math.random() * 10);
    }

    // Check if this Account ID already exists
    const result = await database.query(
      'SELECT id FROM users WHERE account_id = $1',
      [accountId]
    );

    if (result.rows.length === 0) {
      isUnique = true;
    }
  }

  return accountId;
}

/**
 * Signup - Create new user account
 */
exports.signup = [
  // Validation rules
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number'),
  body('phoneNumber')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Valid phone number is required'),

  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const { fullName, email, password, phoneNumber } = req.body;

      // Check if user already exists
      const existingUser = await database.query(
        'SELECT id FROM users WHERE email = $1 OR phone_number = $2',
        [email, phoneNumber]
      );

      if (existingUser.rows.length > 0) {
        return ResponseHandler.error(res, 'Email or phone number already registered', 409);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Generate unique account ID
      const accountId = await generateUniqueAccountId();

      // Insert user
      const result = await database.query(
        `INSERT INTO users (account_id, full_name, email, password_hash, phone_number)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, account_id, full_name, email, phone_number, created_at`,
        [accountId, fullName, email, passwordHash, phoneNumber]
      );

      const user = result.rows[0];

      // Create audit log
      await database.query(
        `INSERT INTO audit_logs (service_name, user_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['auth-service', user.id, 'user_signup', 'user', user.id, req.ip]
      );

      logger.info('New user registered', { userId: user.id, email });

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        accountId: user.account_id
      });

      return ResponseHandler.success(res, {
        user: {
          id: user.id,
          accountId: user.account_id,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number
        },
        token
      }, 'Account created successfully', 201);

    } catch (error) {
      logger.error('Signup error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Login - Authenticate user
 */
exports.login = [
  body('identifier').trim().notEmpty().withMessage('Email or phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const { identifier, password } = req.body;

      // Find user by email or phone
      const result = await database.query(
        `SELECT id, account_id, full_name, email, phone_number, password_hash,
         twofa_enabled, twofa_method, account_status
         FROM users
         WHERE email = $1 OR phone_number = $1`,
        [identifier]
      );

      if (result.rows.length === 0) {
        return ResponseHandler.error(res, 'Invalid credentials', 401);
      }

      const user = result.rows[0];

      // Check account status
      if (user.account_status !== 'active') {
        return ResponseHandler.error(res, 'Account is not active', 403);
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return ResponseHandler.error(res, 'Invalid credentials', 401);
      }

      // If 2FA is enabled, send verification code
      if (user.twofa_enabled) {
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store verification code
        await database.query(
          `INSERT INTO verification_codes (user_id, code, purpose, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [user.id, code, 'login', expiresAt]
        );

        // Send verification code
        if (user.twofa_method === 'email') {
          await sendVerificationEmail(user.email, code, 'Login Verification');
        }
        // TODO: Implement SMS sending for twofa_method === 'sms'

        logger.info('2FA code sent', { userId: user.id, method: user.twofa_method });

        return ResponseHandler.success(res, {
          requires2FA: true,
          userId: user.id,
          method: user.twofa_method
        }, '2FA code sent');
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        accountId: user.account_id
      });

      // Create audit log
      await database.query(
        `INSERT INTO audit_logs (service_name, user_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['auth-service', user.id, 'user_login', 'user', user.id, req.ip]
      );

      logger.info('User logged in', { userId: user.id });

      return ResponseHandler.success(res, {
        user: {
          id: user.id,
          accountId: user.account_id,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number,
          twoFAEnabled: user.twofa_enabled
        },
        token
      }, 'Login successful');

    } catch (error) {
      logger.error('Login error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Refresh token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return ResponseHandler.error(res, 'Token required', 400);
    }

    // Verify and decode old token (allow expired)
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);

    if (!decoded) {
      return ResponseHandler.error(res, 'Invalid token', 401);
    }

    // Generate new token
    const newToken = generateToken({
      userId: decoded.userId,
      email: decoded.email,
      accountId: decoded.accountId
    });

    return ResponseHandler.success(res, { token: newToken }, 'Token refreshed');

  } catch (error) {
    logger.error('Token refresh error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Logout
 */
exports.logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // But we can add to audit log for tracking
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);

      if (decoded && decoded.userId) {
        await database.query(
          `INSERT INTO audit_logs (service_name, user_id, action, ip_address)
           VALUES ($1, $2, $3, $4)`,
          ['auth-service', decoded.userId, 'user_logout', req.ip]
        );
      }
    }

    return ResponseHandler.success(res, null, 'Logged out successfully');

  } catch (error) {
    logger.error('Logout error', error);
    return ResponseHandler.serverError(res, error);
  }
};
