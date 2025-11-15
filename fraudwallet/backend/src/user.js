// User profile management
const bcrypt = require('bcrypt');
const db = require('./database');
const { validatePhoneNumber, canChangePhone } = require('./validation');

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
      SELECT id, full_name, email, phone_number, phone_last_changed, account_status, created_at, updated_at
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
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number,
        phoneLastChanged: user.phone_last_changed,
        accountStatus: user.account_status,
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

module.exports = {
  getProfile,
  updateProfile,
  terminateAccount,
  changePhoneNumber
};
