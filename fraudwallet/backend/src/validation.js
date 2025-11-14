// Validation utilities

/**
 * Validate Malaysian phone number
 * Format: 60 followed by 9-10 digits (11-12 digits total)
 * Examples: 60123456789, 601234567890
 * Note: User only inputs digits, UI displays +60 prefix
 */
const validatePhoneNumber = (phone) => {
  // Remove spaces, dashes, and the "+" symbol
  let cleanPhone = phone.replace(/[\s\-\+]/g, '');

  // Check if it starts with 60 (Malaysian country code)
  if (!cleanPhone.startsWith('60')) {
    return {
      valid: false,
      message: 'Phone number must be a Malaysian number (60XXXXXXXXX)'
    };
  }

  // Check if length is 11-12 digits total
  if (!/^60\d{9,10}$/.test(cleanPhone)) {
    return {
      valid: false,
      message: 'Phone number must be 11-12 digits (60XXXXXXXXX or 60XXXXXXXXXX)'
    };
  }

  return {
    valid: true,
    formatted: cleanPhone  // Returns digits only: "60123456789"
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
