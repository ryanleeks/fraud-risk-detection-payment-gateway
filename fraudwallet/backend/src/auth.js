// Authentication logic
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { generateUniqueAccountId } = require('./database');
const { validatePhoneNumber } = require('./validation');
const { generateCode, storeCode, verifyCode, sendEmailCode, sendSMSCode } = require('./twofa');

// How many times to encrypt the password (higher = more secure but slower)
const SALT_ROUNDS = 10;

/**
 * SIGNUP - Create a new user account
 * Steps:
 * 1. Check if email already exists
 * 2. Hash (encrypt) the password
 * 3. Save user to database
 * 4. Create authentication token
 */
const signup = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber } = req.body;

    // Validate input
    if (!fullName || !email || !password || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, password, and phone number'
      });
    }

    // Validate phone number
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.message
      });
    }

    // Check if email already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if phone number already exists
    const existingPhone = db.prepare('SELECT * FROM users WHERE phone_number = ?').get(phoneValidation.formatted);

    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Hash the password (encrypt it so we don't store plain text)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate unique Account ID
    const accountId = generateUniqueAccountId();

    // Insert new user into database
    const insertUser = db.prepare(`
      INSERT INTO users (account_id, full_name, email, password_hash, phone_number, phone_last_changed)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const result = insertUser.run(accountId, fullName, email, passwordHash, phoneValidation.formatted);
    const userId = result.lastInsertRowid;

    // Create JWT token (like a digital passport)
    const token = jwt.sign(
      { userId, email, role: 'user' },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '7d' } // Token expires in 7 days
    );

    // Return success with token and user info
    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: userId,
        accountId,
        fullName,
        email,
        phoneNumber: phoneValidation.formatted,
        twofaEnabled: false,
        twofaMethod: 'email',
        role: 'user'
      }
    });

    console.log(`✅ New user registered: ${email}`);

  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account'
    });
  }
};

/**
 * LOGIN - Sign in with existing account
 * Steps:
 * 1. Find user by email or phone number
 * 2. Check if password matches
 * 3. Check if 2FA is enabled
 * 4. If 2FA enabled, send verification code
 * 5. Otherwise, create authentication token
 */
const login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    // Validate input
    if (!emailOrPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/phone and password'
      });
    }

    // Determine if input is email or phone (check if it's all digits)
    const isPhone = /^\d+$/.test(emailOrPhone.replace(/[\s\-\+]/g, ''));

    // Find user in database by email or phone
    let user;
    if (isPhone) {
      // Clean phone number (remove spaces, dashes, plus)
      const cleanPhone = emailOrPhone.replace(/[\s\-\+]/g, '');
      // Prepend 60 if not already present
      const fullPhone = cleanPhone.startsWith('60') ? cleanPhone : `60${cleanPhone}`;
      user = db.prepare('SELECT * FROM users WHERE phone_number = ?').get(fullPhone);
    } else {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailOrPhone);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is terminated
    if (user.account_status === 'terminated') {
      return res.status(403).json({
        success: false,
        message: 'This account has been terminated'
      });
    }

    // Check if password matches
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if 2FA is enabled
    if (user.twofa_enabled) {
      // Generate and send verification code
      const code = generateCode();
      storeCode(user.id, code, 'login');

      // Send code based on user's preferred method
      if (user.twofa_method === 'email') {
        await sendEmailCode(user.email, user.full_name, code);
      } else if (user.twofa_method === 'phone') {
        const smsResult = await sendSMSCode(user.phone_number, code);
        if (!smsResult.success) {
          return res.status(400).json({
            success: false,
            message: smsResult.error
          });
        }
      }

      // Return response indicating 2FA is required
      // We send a temporary ID (not a full JWT) for the verification step
      return res.status(200).json({
        success: true,
        requiresTwoFA: true,
        userId: user.id,
        message: `Verification code sent to your ${user.twofa_method}`
      });
    }

    // No 2FA - proceed with normal login
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '7d' }
    );

    // Return success with token and user info
    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        accountId: user.account_id,
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number,
        twofaEnabled: user.twofa_enabled,
        twofaMethod: user.twofa_method,
        role: user.role || 'user'
      }
    });

    console.log(`✅ User logged in: ${user.email}`);

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
};

/**
 * VERIFY 2FA - Verify 2FA code and complete login
 */
const verify2FA = async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        message: 'User ID and verification code are required'
      });
    }

    // Verify the code
    const verification = verifyCode(userId, code, 'login');

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: verification.message
      });
    }

    // Get user details
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '7d' }
    );

    // Return success with token and user info
    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        accountId: user.account_id,
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number,
        twofaEnabled: user.twofa_enabled,
        twofaMethod: user.twofa_method,
        role: user.role || 'user'
      }
    });

    console.log(`✅ User verified 2FA and logged in: ${user.email}`);

  } catch (error) {
    console.error('❌ 2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying code'
    });
  }
};

/**
 * FORGOT PASSWORD - Request password reset OTP
 * Steps:
 * 1. Check if email exists
 * 2. If yes, generate and send OTP
 * 3. If no, return error (email not registered)
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address'
      });
    }

    // Check if email exists
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'This email is not registered'
      });
    }

    // Check if account is terminated
    if (user.account_status === 'terminated') {
      return res.status(403).json({
        success: false,
        message: 'This account has been terminated'
      });
    }

    // Generate and send OTP
    const code = generateCode();
    storeCode(user.id, code, 'password_reset');

    // Send code via email
    await sendEmailCode(user.email, user.full_name, code);

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
      userId: user.id
    });

    console.log(`✅ Password reset code sent to: ${email}`);

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending verification code'
    });
  }
};

/**
 * VERIFY RESET OTP - Verify OTP for password reset
 */
const verifyResetOtp = async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        message: 'User ID and verification code are required'
      });
    }

    // Verify the code
    const verification = verifyCode(userId, code, 'password_reset');

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: verification.message
      });
    }

    // Generate a temporary reset token (valid for 5 minutes)
    const resetToken = jwt.sign(
      { userId, purpose: 'password_reset' },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '5m' }
    );

    res.status(200).json({
      success: true,
      message: 'Code verified successfully',
      resetToken
    });

    console.log(`✅ Password reset OTP verified for user ${userId}`);

  } catch (error) {
    console.error('❌ Verify reset OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying code'
    });
  }
};

/**
 * RESET PASSWORD - Set new password after OTP verification
 */
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required'
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Check password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'default-secret-key');
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new code.'
      });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(401).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password in database
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(passwordHash, user.id);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now login with your new password.'
    });

    console.log(`✅ Password reset successful for: ${user.email}`);

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
};

module.exports = {
  signup,
  login,
  verify2FA,
  forgotPassword,
  verifyResetOtp,
  resetPassword
};
