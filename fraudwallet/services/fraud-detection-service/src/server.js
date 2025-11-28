const express = require('express');
const cors = require('cors');
require('dotenv').config();

const database = require('../../shared/database/postgres');
const Logger = require('../../shared/utils/logger');
const { verifyToken } = require('../../shared/middleware/auth');
const fraudController = require('./controllers/fraudController');

const logger = new Logger('fraud-detection-service');
const app = express();

app.use(cors());
app.use(express.json());
app.use(logger.requestLogger());

app.get('/health', (req, res) => {
  res.json({
    service: 'fraud-detection-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Public fraud check endpoint (called by other services)
app.post('/api/fraud/check-transaction', fraudController.checkTransaction);

// Protected fraud analytics endpoints
app.get('/api/fraud/user-stats', verifyToken, fraudController.getUserStats);
app.get('/api/fraud/system-metrics', verifyToken, fraudController.getSystemMetrics);
app.get('/api/fraud/recent-logs', verifyToken, fraudController.getRecentLogs);
app.get('/api/fraud/high-risk-users', verifyToken, fraudController.getHighRiskUsers);
app.get('/api/fraud/user/:userId', verifyToken, fraudController.getUserFraudDetails);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 3005;

async function startServer() {
  try {
    await database.initialize();
    logger.info('Database connected');
    app.listen(PORT, () => {
      logger.info(`Fraud Detection Service running on port ${PORT}`);
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
