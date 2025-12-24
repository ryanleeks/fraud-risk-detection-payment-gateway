// Transaction Passcode API endpoints
const {
  setPasscode,
  verifyPasscode,
  changePasscode,
  getPasscodeStatus
} = require('./passcode');

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

module.exports = {
  setUserPasscode,
  verifyUserPasscode,
  changeUserPasscode,
  getUserPasscodeStatus
};
