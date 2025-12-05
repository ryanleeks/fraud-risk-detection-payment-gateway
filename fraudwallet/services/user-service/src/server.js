const express = require('express');
const cors = require('cors');
require('dotenv').config();

const database = require('../../shared/database/postgres');
const Logger = require('../../shared/utils/logger');
const { verifyToken } = require('../../shared/middleware/auth');
const userController = require('./controllers/userController');
const profileController = require('./controllers/profileController');

const logger = new Logger('user-service');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger.requestLogger());

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'user-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// User profile routes (protected)
app.get('/api/user/profile', verifyToken, profileController.getProfile);
app.put('/api/user/profile', verifyToken, profileController.updateProfile);
app.put('/api/user/phone', verifyToken, profileController.changePhoneNumber);
app.post('/api/user/terminate', verifyToken, profileController.terminateAccount);

// 2FA management routes (protected)
app.post('/api/user/2fa/toggle', verifyToken, userController.toggle2FA);
app.put('/api/user/2fa/method', verifyToken, userController.update2FAMethod);
app.post('/api/user/2fa/test', verifyToken, userController.send2FATest);

// Payment lookup routes (protected)
app.post('/api/user/lookup-recipient', verifyToken, userController.lookupRecipient);
app.post('/api/payment/lookup-recipient', verifyToken, userController.lookupRecipient);

// QR Code generation
app.get('/api/user/qrcode', verifyToken, userController.generateQRCode);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    await database.initialize();
    logger.info('Database connected');

    app.listen(PORT, () => {
      logger.info(`User Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await database.close();
  process.exit(0);
});

startServer();

module.exports = app;
