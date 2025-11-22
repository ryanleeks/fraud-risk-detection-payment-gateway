// Two-Factor Authentication Service
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./database');

/**
 * Generate a secure 6-digit verification code
 */
const generateCode = () => {
  // Generate cryptographically secure random 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  return code;
};

/**
 * Store verification code in database
 */
const storeCode = (userId, code, purpose = 'login') => {
  // Set expiration to 10 minutes from now
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Delete any existing unused codes for this user and purpose
  db.prepare('DELETE FROM verification_codes WHERE user_id = ? AND purpose = ? AND used = 0')
    .run(userId, purpose);

  // Insert new code
  db.prepare(`
    INSERT INTO verification_codes (user_id, code, purpose, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, code, purpose, expiresAt);

  console.log(`✅ Verification code stored for user ${userId}`);
};

/**
 * Verify a code for a user
 */
const verifyCode = (userId, code, purpose = 'login') => {
  const now = new Date().toISOString();

  // Find the code
  const storedCode = db.prepare(`
    SELECT * FROM verification_codes
    WHERE user_id = ? AND code = ? AND purpose = ? AND used = 0 AND expires_at > ?
  `).get(userId, code, purpose, now);

  if (!storedCode) {
    return { valid: false, message: 'Invalid or expired code' };
  }

  // Mark code as used
  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?')
    .run(storedCode.id);

  console.log(`✅ Code verified for user ${userId}`);
  return { valid: true };
};

/**
 * Create email transporter
 * For development, we'll use ethereal.email (fake SMTP for testing)
 * For production, you should use a real email service like:
 * - Gmail (with app password)
 * - SendGrid
 * - Amazon SES
 * - Mailgun
 */
const createTransporter = async () => {
  // Check if custom SMTP settings are in environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // For development/testing, create a test account on ethereal.email
  console.log('⚠️  No SMTP configured. Using Ethereal test account for development.');
  console.log('💡 Add SMTP settings to .env for production:');
  console.log('   SMTP_HOST=smtp.gmail.com');
  console.log('   SMTP_PORT=587');
  console.log('   SMTP_USER=your-email@gmail.com');
  console.log('   SMTP_PASS=your-app-password');

  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
};

/**
 * Send verification code via email
 */
const sendEmailCode = async (userEmail, userName, code) => {
  try {
    const transporter = await createTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || '"FraudWallet Security" <noreply@fraudwallet.com>',
      to: userEmail,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verification Code</h2>
          <p>Hi ${userName},</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #888; font-size: 12px;">FraudWallet - Fraud Detection & Risk Mitigation System</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    // If using ethereal, log the preview URL
    if (info.messageId && !process.env.SMTP_HOST) {
      console.log('📧 Email sent! Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    console.log(`✅ Verification email sent to ${userEmail}`);
    return { success: true };

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send verification code via SMS (requires paid service)
 * For now, this is a placeholder. You'll need to set up Twilio or similar service.
 */
const sendSMSCode = async (phoneNumber, code) => {
  console.log('⚠️  SMS not implemented yet. Requires paid SMS service like Twilio.');
  console.log(`Would send code ${code} to ${phoneNumber}`);

  // TODO: Implement Twilio integration
  // Example:
  // const twilio = require('twilio');
  // const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // await client.messages.create({
  //   body: `Your FraudWallet verification code is: ${code}`,
  //   to: `+${phoneNumber}`,
  //   from: process.env.TWILIO_PHONE
  // });

  return {
    success: false,
    error: 'SMS sending not configured. Please use email verification instead.'
  };
};

module.exports = {
  generateCode,
  storeCode,
  verifyCode,
  sendEmailCode,
  sendSMSCode
};
