// User profile management
const bcrypt = require('bcrypt');
const db = require('./database');
const { validatePhoneNumber, canChangePhone } = require('./validation');
const { generateCode, storeCode, verifyCode, sendEmailCode, sendSMSCode } = require('./twofa');
const { getLocationFromIP } = require('./fraud-detection/utils/geolocation');

const SALT_ROUNDS = 10;

/**
 * GET USER PROFILE
 * Get logged-in user's profile information
 */
const getProfile = (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user from database (exclude password)
    const user = db.prepare(`
      SELECT id, account_id, full_name, email, phone_number, phone_last_changed, account_status, twofa_enabled, twofa_method, wallet_balance, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        accountId: user.account_id,
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number,
        phoneLastChanged: user.phone_last_changed,
        accountStatus: user.account_status,
        twofaEnabled: user.twofa_enabled,
        twofaMethod: user.twofa_method,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
};

/**
 * UPDATE USER PROFILE
 * Update user's full name and/or password
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, currentPassword, newPassword } = req.body;

    // Get current user data
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prepare update fields
    const updates = [];
    const values = [];

    // Update full name if provided
    if (fullName && fullName.trim() !== '') {
      updates.push('full_name = ?');
      values.push(fullName.trim());
    }

    // Update password if provided
    if (newPassword) {
      // Verify current password first
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to change password'
        });
      }

      const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Check new password length
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters'
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      updates.push('password_hash = ?');
      values.push(newPasswordHash);
    }

    // Check if there's anything to update
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    // Add updated_at timestamp
    updates.push('updated_at = CURRENT_TIMESTAMP');

    // Add userId to values for WHERE clause
    values.push(userId);

    // Build and execute update query
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    // Get updated user data
    const updatedUser = db.prepare(`
      SELECT id, full_name, email, account_status, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(userId);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        accountStatus: updatedUser.account_status,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      }
    });

    console.log(`✅ User ${userId} updated profile`);

  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

/**
 * TERMINATE ACCOUNT
 * Soft delete - change account status to 'terminated'
 * User data remains in database but account cannot login
 */
const terminateAccount = (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;

    // Verify password before terminating
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    bcrypt.compare(password, user.password_hash, (err, passwordMatch) => {
      if (err || !passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password'
        });
      }

      // Update account status to terminated
      db.prepare(`
        UPDATE users
        SET account_status = 'terminated',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(userId);

      res.status(200).json({
        success: true,
        message: 'Account terminated successfully'
      });

      console.log(`⚠️ User ${userId} (${user.email}) terminated their account`);
    });

  } catch (error) {
    console.error('❌ Terminate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error terminating account'
    });
  }
};

/**
 * CHANGE PHONE NUMBER
 * Users can change their phone number once every 90 days
 */
const changePhoneNumber = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { newPhoneNumber, password } = req.body;

    if (!newPhoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required'
      });
    }

    // Validate phone number format
    const phoneValidation = validatePhoneNumber(newPhoneNumber);
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.message
      });
    }

    // Get current user data
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Check if new phone is same as current (only if user already has a phone)
    if (user.phone_number && user.phone_number === phoneValidation.formatted) {
      return res.status(400).json({
        success: false,
        message: 'This is already your current phone number'
      });
    }

    // Check if phone number is already used by another user
    const existingPhone = db.prepare('SELECT * FROM users WHERE phone_number = ? AND id != ?')
      .get(phoneValidation.formatted, userId);

    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already registered to another account'
      });
    }

    // Check if user can change phone (90-day restriction) - only if they already have a phone
    if (user.phone_number) {
      const changeCheck = canChangePhone(user.phone_last_changed);
      if (!changeCheck.canChange) {
        return res.status(403).json({
          success: false,
          message: changeCheck.message,
          daysRemaining: changeCheck.daysRemaining
        });
      }
    }

    // Update phone number
    db.prepare(`
      UPDATE users
      SET phone_number = ?,
          phone_last_changed = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(phoneValidation.formatted, userId);

    const wasAdded = !user.phone_number; // true if this is the first time adding a phone

    res.status(200).json({
      success: true,
      message: wasAdded ? 'Phone number added successfully' : 'Phone number updated successfully',
      phoneNumber: phoneValidation.formatted
    });

    console.log(`✅ User ${userId} ${wasAdded ? 'added' : 'changed'} phone number`);

  } catch (error) {
    console.error('❌ Change phone number error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing phone number'
    });
  }
};

/**
 * TOGGLE 2FA
 * Enable or disable two-factor authentication
 * - Enable: No password required, just confirmation
 * - Disable: Requires password AND 2FA code verification
 */
const toggle2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { enabled, password, code } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Please provide enabled status'
      });
    }

    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Different requirements for enabling vs disabling
    if (enabled) {
      // ENABLING 2FA: No password required, just enable it
      db.prepare('UPDATE users SET twofa_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(userId);

      res.status(200).json({
        success: true,
        message: '2FA enabled successfully',
        twofaEnabled: true
      });

      console.log(`✅ User ${userId} enabled 2FA`);

    } else {
      // DISABLING 2FA: Requires password AND 2FA code
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to disable 2FA'
        });
      }

      if (!code) {
        return res.status(400).json({
          success: false,
          message: '2FA code is required to disable 2FA'
        });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password'
        });
      }

      // Verify 2FA code
      const codeVerification = verifyCode(userId, code, 'disable_2fa');
      if (!codeVerification.valid) {
        return res.status(401).json({
          success: false,
          message: codeVerification.message || 'Invalid or expired 2FA code'
        });
      }

      // Update 2FA status
      db.prepare('UPDATE users SET twofa_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(userId);

      res.status(200).json({
        success: true,
        message: '2FA disabled successfully',
        twofaEnabled: false
      });

      console.log(`✅ User ${userId} disabled 2FA`);
    }

  } catch (error) {
    console.error('❌ Toggle 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating 2FA settings'
    });
  }
};

/**
 * SEND DISABLE CODE
 * Send 2FA verification code for disabling 2FA (requires password verification first)
 */
const sendDisableCode = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Generate and send 2FA code
    const code = generateCode();
    storeCode(userId, code, 'disable_2fa');

    // Send code based on user's 2FA method
    if (user.twofa_method === 'email') {
      await sendEmailCode(user.email, user.full_name, code);
    } else if (user.twofa_method === 'phone') {
      await sendSMSCode(user.phone_number, code);
    }

    res.status(200).json({
      success: true,
      message: `Verification code sent to your ${user.twofa_method}`
    });

    console.log(`✅ Sent disable 2FA code to user ${userId}`);

  } catch (error) {
    console.error('❌ Send disable code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending verification code'
    });
  }
};

/**
 * UPDATE 2FA METHOD
 * Change 2FA method between email and phone
 */
const update2FAMethod = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { method, password } = req.body;

    if (!method || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide method and password'
      });
    }

    if (method !== 'email' && method !== 'phone') {
      return res.status(400).json({
        success: false,
        message: 'Method must be "email" or "phone"'
      });
    }

    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Check if phone method is selected but user has no phone
    if (method === 'phone' && !user.phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Please add a phone number before enabling phone-based 2FA'
      });
    }

    // Update 2FA method
    db.prepare('UPDATE users SET twofa_method = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(method, userId);

    res.status(200).json({
      success: true,
      message: `2FA method updated to ${method}`,
      twofaMethod: method
    });

    console.log(`✅ User ${userId} changed 2FA method to ${method}`);

  } catch (error) {
    console.error('❌ Update 2FA method error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating 2FA method'
    });
  }
};

/**
 * SEND 2FA TEST CODE
 * Send a test verification code to user's email or phone
 */
const send2FATest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { method } = req.body;

    if (!method || (method !== 'email' && method !== 'phone')) {
      return res.status(400).json({
        success: false,
        message: 'Please specify method: "email" or "phone"'
      });
    }

    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if phone method is selected but user has no phone
    if (method === 'phone' && !user.phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Please add a phone number first'
      });
    }

    // Generate and send test code
    const code = generateCode();
    storeCode(user.id, code, 'test');

    // Send code based on method
    if (method === 'email') {
      await sendEmailCode(user.email, user.full_name, code);
    } else if (method === 'phone') {
      const smsResult = await sendSMSCode(user.phone_number, code);
      if (!smsResult.success) {
        return res.status(400).json({
          success: false,
          message: smsResult.error
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Test code sent to your ${method}`
    });

    console.log(`✅ Test 2FA code sent to user ${userId} via ${method}`);

  } catch (error) {
    console.error('❌ Send 2FA test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test code'
    });
  }
};

/**
 * LOOKUP RECIPIENT
 * Search for a user by phone number, email, or Account ID
 */
const lookupRecipient = (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a search query'
      });
    }

    const searchQuery = query.trim();
    let recipient = null;

    // Try to find by Account ID (12 digits)
    if (/^\d{12}$/.test(searchQuery)) {
      recipient = db.prepare(`
        SELECT id, account_id, full_name, email, phone_number
        FROM users
        WHERE account_id = ? AND account_status = 'active'
      `).get(searchQuery);
    }

    // If not found, try to find by email
    if (!recipient && searchQuery.includes('@')) {
      recipient = db.prepare(`
        SELECT id, account_id, full_name, email, phone_number
        FROM users
        WHERE email = ? AND account_status = 'active'
      `).get(searchQuery);
    }

    // If not found, try to find by phone number
    if (!recipient) {
      // Normalize phone number (remove spaces, dashes, plus)
      const phoneDigits = searchQuery.replace(/[\s\-\+]/g, '');
      const fullPhone = phoneDigits.startsWith('60') ? phoneDigits : `60${phoneDigits}`;

      recipient = db.prepare(`
        SELECT id, account_id, full_name, email, phone_number
        FROM users
        WHERE phone_number = ? AND account_status = 'active'
      `).get(fullPhone);
    }

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found. Please check the phone number, email, or Account ID.'
      });
    }

    // Don't allow users to send to themselves
    if (recipient.id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send money to yourself'
      });
    }

    res.status(200).json({
      success: true,
      recipient: {
        id: recipient.id,
        accountId: recipient.account_id,
        fullName: recipient.full_name,
        email: recipient.email,
        phoneNumber: recipient.phone_number
      }
    });

    console.log(`✅ User ${req.user.userId} looked up recipient: ${recipient.full_name}`);

  } catch (error) {
    console.error('❌ Lookup recipient error:', error);
    res.status(500).json({
      success: false,
      message: 'Error looking up recipient'
    });
  }
};

/**
 * GET USER TIMEZONE
 * Get user's timezone based on their IP address
 */
const getUserTimezone = (req, res) => {
  try {
    // Extract IP address from request
    const getClientIP = (req) => {
      return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
             req.headers['x-real-ip'] ||
             req.connection?.remoteAddress ||
             req.socket?.remoteAddress ||
             req.ip ||
             'unknown';
    };

    const ipAddress = getClientIP(req);
    console.log(`🌍 Getting timezone for IP: ${ipAddress}`);

    // Get location from IP
    const location = getLocationFromIP(ipAddress);

    // Default to UTC+8 (Malaysia) for localhost/local IPs
    let timezone = 'Asia/Kuala_Lumpur';
    let offsetHours = 8;

    if (location.timezone && location.country !== 'Local') {
      timezone = location.timezone;

      // Calculate offset hours from timezone
      try {
        const date = new Date();
        const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
        const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
        offsetHours = Math.round((localDate - utcDate) / (1000 * 60 * 60));
      } catch (error) {
        console.error('Error calculating timezone offset:', error);
        offsetHours = 8; // Default to UTC+8
      }
    }

    // Format offset string (e.g., "+08:00" or "-05:00")
    const offsetSign = offsetHours >= 0 ? '+' : '';
    const offsetString = `${offsetSign}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`;

    // Format offset label for display (e.g., "UTC+8" or "UTC-5")
    const offsetLabel = `UTC${offsetSign}${Math.abs(offsetHours)}`;

    res.status(200).json({
      success: true,
      timezone,
      offset: offsetString,
      offsetHours,
      offsetLabel,
      country: location.country,
      city: location.city,
      ipAddress
    });

    console.log(`✅ Timezone: ${timezone} (${offsetLabel})`);

  } catch (error) {
    console.error('❌ Get timezone error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting timezone',
      // Default to UTC+8 on error
      timezone: 'Asia/Kuala_Lumpur',
      offset: '+08:00',
      offsetHours: 8,
      offsetLabel: 'UTC+8'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  terminateAccount,
  changePhoneNumber,
  toggle2FA,
  sendDisableCode,
  update2FAMethod,
  send2FATest,
  lookupRecipient,
  getUserTimezone
};
