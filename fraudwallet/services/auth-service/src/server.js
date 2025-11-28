const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const database = require('../../shared/database/postgres');
const Logger = require('../../shared/utils/logger');
const authController = require('./controllers/authController');
const twoFAController = require('./controllers/twoFAController');

const logger = new Logger('auth-service');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger.requestLogger());

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

const twoFALimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many 2FA attempts, please try again later.'
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'auth-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
app.post('/api/auth/signup', authLimiter, authController.signup);
app.post('/api/auth/login', authLimiter, authController.login);
app.post('/api/auth/verify-2fa', twoFALimiter, twoFAController.verify2FA);
app.post('/api/auth/refresh-token', authController.refreshToken);
app.post('/api/auth/logout', authController.logout);

// 2FA management routes
app.post('/api/auth/2fa/send-code', twoFALimiter, twoFAController.sendCode);
app.post('/api/auth/2fa/send-disable-code', twoFALimiter, twoFAController.sendDisableCode);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Initialize database connection
    await database.initialize();
    logger.info('Database connected');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await database.close();
  process.exit(0);
});

startServer();

module.exports = app;
