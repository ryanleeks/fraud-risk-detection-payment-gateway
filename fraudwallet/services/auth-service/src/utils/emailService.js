const nodemailer = require('nodemailer');
const Logger = require('../../../shared/utils/logger');

const logger = new Logger('email-service');

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send verification email
 */
async function sendVerificationEmail(email, code, subject = 'Verification Code', customMessage = null) {
  try {
    const message = customMessage || `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.`;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"FraudWallet Security" <noreply@fraudwallet.com>',
      to: email,
      subject: subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">FraudWallet Security</h2>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h1 style="color: #4CAF50; text-align: center; margin: 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p style="color: #666; font-size: 12px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', { to: email, messageId: info.messageId });
    return true;

  } catch (error) {
    logger.error('Failed to send email', error);
    throw error;
  }
}

/**
 * Send welcome email
 */
async function sendWelcomeEmail(email, fullName) {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"FraudWallet" <noreply@fraudwallet.com>',
      to: email,
      subject: 'Welcome to FraudWallet!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Welcome to FraudWallet!</h2>
          <p>Hello ${fullName},</p>
          <p>Thank you for joining FraudWallet. Your account has been successfully created.</p>
          <p>You can now:</p>
          <ul>
            <li>Send and receive money securely</li>
            <li>Split bills with friends</li>
            <li>Track your transactions</li>
            <li>Enable Two-Factor Authentication for extra security</li>
          </ul>
          <p>Stay safe and secure!</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            The FraudWallet Team
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info('Welcome email sent', { to: email });
    return true;

  } catch (error) {
    logger.error('Failed to send welcome email', error);
    // Don't throw - welcome email is not critical
    return false;
  }
}

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail
};
