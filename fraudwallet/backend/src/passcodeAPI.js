// Transaction Passcode API endpoints
const {
  setPasscode,
  verifyPasscode,
  changePasscode,
  resetPasscode,
  getPasscodeStatus,
  hasPasscode
} = require('./passcode');
const db = require('./database');
const jwt = require('jsonwebtoken');
const { generateCode, storeCode, verifyCode, sendEmailCode } = require('./twofa');

/**
 * Set or update transaction passcode
 * POST /api/user/passcode/set
 * Body: { passcode, currentPassword }
 */
const setUserPasscode = async (req, res) => {
  try {
    const { passcode, currentPassword } = req.body;
    const userId = req.user.userId;

    if (!passcode || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passcode and current password are required'
      });
    }

    const result = await setPasscode(userId, passcode, currentPassword);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in setUserPasscode:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set passcode'
    });
  }
};

/**
 * Verify transaction passcode
 * POST /api/user/passcode/verify
 * Body: { passcode }
 */
const verifyUserPasscode = async (req, res) => {
  try {
    const { passcode } = req.body;
    const userId = req.user.userId;

    if (!passcode) {
      return res.status(400).json({
        success: false,
        message: 'Passcode is required'
      });
    }

    const result = await verifyPasscode(userId, passcode);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      // Return 401 for authentication failure, 429 for too many attempts
      const statusCode = result.locked ? 429 : 401;
      return res.status(statusCode).json(result);
    }
  } catch (error) {
    console.error('Error in verifyUserPasscode:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify passcode'
    });
  }
};

/**
 * Change transaction passcode
 * POST /api/user/passcode/change
 * Body: { oldPasscode, newPasscode }
 */
const changeUserPasscode = async (req, res) => {
  try {
    const { oldPasscode, newPasscode } = req.body;
    const userId = req.user.userId;

    if (!oldPasscode || !newPasscode) {
      return res.status(400).json({
        success: false,
        message: 'Old passcode and new passcode are required'
      });
    }

    if (oldPasscode === newPasscode) {
      return res.status(400).json({
        success: false,
        message: 'New passcode must be different from old passcode'
      });
    }

    const result = await changePasscode(userId, oldPasscode, newPasscode);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      const statusCode = result.locked ? 429 : 401;
      return res.status(statusCode).json(result);
    }
  } catch (error) {
    console.error('Error in changeUserPasscode:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change passcode'
    });
  }
};

/**
 * Get passcode status (whether user has set up passcode)
 * GET /api/user/passcode/status
 */
const getUserPasscodeStatus = (req, res) => {
  try {
    const userId = req.user.userId;
    const status = getPasscodeStatus(userId);

    return res.status(200).json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Error in getUserPasscodeStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get passcode status'
    });
  }
};

/**
 * Forgot passcode - Send OTP to user's email
 * POST /api/user/passcode/forgot
 */
const forgotPasscode = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's email
    const user = db.prepare('SELECT id, email, full_name, transaction_passcode FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has a passcode set
    if (!user.transaction_passcode) {
      return res.status(400).json({
        success: false,
        message: 'You do not have a transaction passcode set up'
      });
    }

    // Generate and store OTP code
    const code = generateCode();
    storeCode(userId, code, 'passcode_reset');

    // Send code via email
    await sendEmailCode(user.email, user.full_name, code);

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email'
    });

    console.log(`✅ Passcode reset code sent to user ${userId}`);

  } catch (error) {
    console.error('Error in forgotPasscode:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code'
    });
  }
};

/**
 * Verify OTP for passcode reset
 * POST /api/user/passcode/verify-otp
 * Body: { code }
 */
const verifyPasscodeOtp = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.userId;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required'
      });
    }

    // Verify the code
    const verification = verifyCode(userId, code, 'passcode_reset');

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: verification.message
      });
    }

    // Generate a temporary reset token (valid for 5 minutes)
    const resetToken = jwt.sign(
      { userId, purpose: 'passcode_reset' },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '5m' }
    );

    res.status(200).json({
      success: true,
      message: 'Code verified successfully',
      resetToken
    });

    console.log(`✅ Passcode reset OTP verified for user ${userId}`);

  } catch (error) {
    console.error('Error in verifyPasscodeOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify code'
    });
  }
};

/**
 * Reset passcode after OTP verification
 * POST /api/user/passcode/reset
 * Body: { resetToken, newPasscode }
 */
const resetUserPasscode = async (req, res) => {
  try {
    const { resetToken, newPasscode } = req.body;

    if (!resetToken || !newPasscode) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new passcode are required'
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

    if (decoded.purpose !== 'passcode_reset') {
      return res.status(401).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    // Reset the passcode
    const result = await resetPasscode(decoded.userId, newPasscode);

    if (result.success) {
      res.status(200).json(result);
      console.log(`✅ Passcode reset successful for user ${decoded.userId}`);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error in resetUserPasscode:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset passcode'
    });
  }
};

module.exports = {
  setUserPasscode,
  verifyUserPasscode,
  changeUserPasscode,
  getUserPasscodeStatus,
  forgotPasscode,
  verifyPasscodeOtp,
  resetUserPasscode
};
