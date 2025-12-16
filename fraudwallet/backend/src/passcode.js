// Transaction Passcode Management
const bcrypt = require('bcrypt');
const db = require('./database');

const SALT_ROUNDS = 10;
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Validate passcode format (6 digits only)
 */
const validatePasscodeFormat = (passcode) => {
  if (!passcode) {
    return { valid: false, message: 'Passcode is required' };
  }

  if (typeof passcode !== 'string') {
    return { valid: false, message: 'Passcode must be a string' };
  }

  if (passcode.length !== 6) {
    return { valid: false, message: 'Passcode must be exactly 6 digits' };
  }

  if (!/^\d{6}$/.test(passcode)) {
    return { valid: false, message: 'Passcode must contain only numbers' };
  }

  return { valid: true };
};

/**
 * Check if user has a passcode set up
 */
const hasPasscode = (userId) => {
  try {
    const user = db.prepare('SELECT transaction_passcode FROM users WHERE id = ?').get(userId);
    return user && user.transaction_passcode !== null;
  } catch (error) {
    console.error('Error checking passcode existence:', error);
    throw error;
  }
};

/**
 * Check if user is currently locked out due to too many failed attempts
 */
const isLockedOut = (userId) => {
  try {
    const user = db.prepare('SELECT passcode_locked_until FROM users WHERE id = ?').get(userId);

    if (!user || !user.passcode_locked_until) {
      return false;
    }

    const lockoutTime = new Date(user.passcode_locked_until);
    const now = new Date();

    if (now < lockoutTime) {
      const minutesRemaining = Math.ceil((lockoutTime - now) / 60000);
      return { locked: true, minutesRemaining };
    }

    // Lockout expired, reset attempts
    db.prepare('UPDATE users SET passcode_attempts = 0, passcode_locked_until = NULL WHERE id = ?').run(userId);
    return false;
  } catch (error) {
    console.error('Error checking lockout status:', error);
    throw error;
  }
};

/**
 * Set or update transaction passcode for a user
 */
const setPasscode = async (userId, passcode, currentPassword) => {
  try {
    // Validate passcode format
    const validation = validatePasscodeFormat(passcode);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // Verify current password for security
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return { success: false, message: 'Invalid password' };
    }

    // Hash the passcode
    const hashedPasscode = await bcrypt.hash(passcode, SALT_ROUNDS);

    // Update user's passcode
    db.prepare('UPDATE users SET transaction_passcode = ?, passcode_attempts = 0, passcode_locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPasscode, userId);

    return { success: true, message: 'Transaction passcode set successfully' };
  } catch (error) {
    console.error('Error setting passcode:', error);
    return { success: false, message: 'Failed to set passcode' };
  }
};

/**
 * Verify transaction passcode
 */
const verifyPasscode = async (userId, passcode) => {
  try {
    // Validate passcode format
    const validation = validatePasscodeFormat(passcode);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // Check if user is locked out
    const lockoutStatus = isLockedOut(userId);
    if (lockoutStatus && lockoutStatus.locked) {
      return {
        success: false,
        message: `Too many failed attempts. Please try again in ${lockoutStatus.minutesRemaining} minute(s)`,
        locked: true
      };
    }

    // Get user's passcode
    const user = db.prepare('SELECT transaction_passcode, passcode_attempts FROM users WHERE id = ?').get(userId);

    if (!user || !user.transaction_passcode) {
      return { success: false, message: 'Transaction passcode not set up' };
    }

    // Verify passcode
    const passcodeMatch = await bcrypt.compare(passcode, user.transaction_passcode);

    if (passcodeMatch) {
      // Success - reset attempts
      db.prepare('UPDATE users SET passcode_attempts = 0, passcode_locked_until = NULL WHERE id = ?').run(userId);
      return { success: true, message: 'Passcode verified' };
    } else {
      // Failed attempt
      const newAttempts = (user.passcode_attempts || 0) + 1;

      if (newAttempts >= MAX_ATTEMPTS) {
        // Lock out user
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);

        db.prepare('UPDATE users SET passcode_attempts = ?, passcode_locked_until = ? WHERE id = ?')
          .run(newAttempts, lockoutUntil.toISOString(), userId);

        return {
          success: false,
          message: `Too many failed attempts. Your account is locked for ${LOCKOUT_DURATION_MINUTES} minutes`,
          locked: true
        };
      } else {
        // Increment attempts
        db.prepare('UPDATE users SET passcode_attempts = ? WHERE id = ?').run(newAttempts, userId);

        const remainingAttempts = MAX_ATTEMPTS - newAttempts;
        return {
          success: false,
          message: `Incorrect passcode. ${remainingAttempts} attempt(s) remaining`,
          remainingAttempts
        };
      }
    }
  } catch (error) {
    console.error('Error verifying passcode:', error);
    return { success: false, message: 'Failed to verify passcode' };
  }
};

/**
 * Change transaction passcode (requires old passcode)
 */
const changePasscode = async (userId, oldPasscode, newPasscode) => {
  try {
    // Validate new passcode format
    const validation = validatePasscodeFormat(newPasscode);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // Check if user is locked out
    const lockoutStatus = isLockedOut(userId);
    if (lockoutStatus && lockoutStatus.locked) {
      return {
        success: false,
        message: `Too many failed attempts. Please try again in ${lockoutStatus.minutesRemaining} minute(s)`
      };
    }

    // Verify old passcode first
    const verifyResult = await verifyPasscode(userId, oldPasscode);
    if (!verifyResult.success) {
      return verifyResult;
    }

    // Hash the new passcode
    const hashedPasscode = await bcrypt.hash(newPasscode, SALT_ROUNDS);

    // Update passcode
    db.prepare('UPDATE users SET transaction_passcode = ?, passcode_attempts = 0, passcode_locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPasscode, userId);

    return { success: true, message: 'Transaction passcode changed successfully' };
  } catch (error) {
    console.error('Error changing passcode:', error);
    return { success: false, message: 'Failed to change passcode' };
  }
};

/**
 * Get passcode status for a user
 */
const getPasscodeStatus = (userId) => {
  try {
    const user = db.prepare('SELECT transaction_passcode, passcode_attempts, passcode_locked_until FROM users WHERE id = ?').get(userId);

    if (!user) {
      return { hasPasscode: false, isLocked: false };
    }

    const lockoutStatus = isLockedOut(userId);

    return {
      hasPasscode: user.transaction_passcode !== null,
      isLocked: lockoutStatus && lockoutStatus.locked ? true : false,
      attempts: user.passcode_attempts || 0,
      lockoutMinutes: lockoutStatus && lockoutStatus.locked ? lockoutStatus.minutesRemaining : 0
    };
  } catch (error) {
    console.error('Error getting passcode status:', error);
    throw error;
  }
};

module.exports = {
  validatePasscodeFormat,
  hasPasscode,
  isLockedOut,
  setPasscode,
  verifyPasscode,
  changePasscode,
  getPasscodeStatus
};
