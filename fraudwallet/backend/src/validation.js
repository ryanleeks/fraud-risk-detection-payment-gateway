// Validation utilities

/**
 * Validate Malaysian phone number
 * Format: +60 followed by 10-11 digits
 * Examples: +60123456789, +601234567890
 */
const validatePhoneNumber = (phone) => {
  // Remove spaces and dashes
  const cleanPhone = phone.replace(/[\s-]/g, '');

  // Check if it starts with +60
  if (!cleanPhone.startsWith('+60')) {
    return {
      valid: false,
      message: 'Phone number must start with +60 (Malaysia country code)'
    };
  }

  // Remove +60 and check remaining digits
  const digits = cleanPhone.substring(3);

  // Check if it's 10-11 digits
  if (!/^\d{10,11}$/.test(digits)) {
    return {
      valid: false,
      message: 'Phone number must have 10-11 digits after +60'
    };
  }

  return {
    valid: true,
    formatted: cleanPhone
  };
};

/**
 * Check if user can change phone number
 * Users can only change phone once every 90 days
 */
const canChangePhone = (lastChangedDate) => {
  if (!lastChangedDate) {
    return { canChange: true };
  }

  const lastChanged = new Date(lastChangedDate);
  const now = new Date();
  const daysSinceChange = Math.floor((now - lastChanged) / (1000 * 60 * 60 * 24));

  if (daysSinceChange < 90) {
    const daysRemaining = 90 - daysSinceChange;
    return {
      canChange: false,
      daysRemaining,
      message: `You can change your phone number again in ${daysRemaining} days`
    };
  }

  return { canChange: true };
};

module.exports = {
  validatePhoneNumber,
  canChangePhone
};
