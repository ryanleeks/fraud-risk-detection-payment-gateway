// Admin API - User management endpoints
const bcrypt = require('bcrypt');
const db = require('./database');

const SALT_ROUNDS = 10;

/**
 * GET /api/admin/users
 * Get all users (excluding passwords)
 */
const getAllUsers = (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        id,
        account_id,
        full_name,
        email,
        phone_number,
        account_status,
        twofa_enabled,
        twofa_method,
        wallet_balance,
        role,
        created_at,
        updated_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.status(200).json({
      success: true,
      users
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
};

/**
 * GET /api/admin/users/:userId
 * Get specific user details (excluding password)
 */
const getUserById = (req, res) => {
  try {
    const { userId } = req.params;

    const user = db.prepare(`
      SELECT
        id,
        account_id,
        full_name,
        email,
        phone_number,
        phone_last_changed,
        account_status,
        twofa_enabled,
        twofa_method,
        wallet_balance,
        role,
        created_at,
        updated_at
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
      user
    });

  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user'
    });
  }
};

/**
 * PATCH /api/admin/users/:userId/status
 * Update user account status (activate/suspend)
 */
const updateUserStatus = (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'terminated'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "active" or "terminated"'
      });
    }

    // Check if user exists
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user status
    db.prepare(`
      UPDATE users
      SET account_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, userId);

    res.status(200).json({
      success: true,
      message: `User account ${status === 'active' ? 'activated' : 'suspended'} successfully`
    });

    console.log(`✅ Admin updated user ${user.email} status to ${status}`);

  } catch (error) {
    console.error('❌ Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status'
    });
  }
};

/**
 * PATCH /api/admin/users/:userId/password
 * Reset user password
 */
const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    // Validate input
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user exists
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, userId);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

    console.log(`✅ Admin reset password for user ${user.email}`);

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
};

/**
 * PATCH /api/admin/users/:userId/passcode
 * Reset user transaction passcode
 */
const resetUserPasscode = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPasscode } = req.body;

    // Validate input - must be 6 digits
    if (!newPasscode || !/^\d{6}$/.test(newPasscode)) {
      return res.status(400).json({
        success: false,
        message: 'Passcode must be exactly 6 digits'
      });
    }

    // Check if user exists
    const user = db.prepare('SELECT id, email, transaction_passcode FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new passcode
    const passcodeHash = await bcrypt.hash(newPasscode, SALT_ROUNDS);

    // Update passcode and clear any lockout
    db.prepare(`
      UPDATE users
      SET transaction_passcode = ?, passcode_attempts = 0, passcode_locked_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passcodeHash, userId);

    res.status(200).json({
      success: true,
      message: 'Transaction passcode reset successfully'
    });

    console.log(`✅ Admin reset passcode for user ${user.email}`);

  } catch (error) {
    console.error('❌ Error resetting passcode:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting passcode'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserStatus,
  resetUserPassword,
  resetUserPasscode
};
