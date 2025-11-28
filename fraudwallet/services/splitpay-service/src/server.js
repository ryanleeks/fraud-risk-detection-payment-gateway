const express = require('express');
const cors = require('cors');
require('dotenv').config();

const database = require('../../shared/database/postgres');
const Logger = require('../../shared/utils/logger');
const { verifyToken } = require('../../shared/middleware/auth');
const splitPayController = require('./controllers/splitPayController');

const logger = new Logger('splitpay-service');
const app = express();

app.use(cors());
app.use(express.json());
app.use(logger.requestLogger());

app.get('/health', (req, res) => {
  res.json({
    service: 'splitpay-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// SplitPay routes (protected)
app.post('/api/splitpay/create', verifyToken, splitPayController.createSplitPayment);
app.get('/api/splitpay/my-splits', verifyToken, splitPayController.getMySplitPayments);
app.post('/api/splitpay/respond', verifyToken, splitPayController.respondToSplitPayment);
app.post('/api/splitpay/pay', verifyToken, splitPayController.payMyShare);
app.post('/api/splitpay/cancel', verifyToken, splitPayController.cancelSplitPayment);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 3004;

async function startServer() {
  try {
    await database.initialize();
    logger.info('Database connected');
    app.listen(PORT, () => {
      logger.info(`SplitPay Service running on port ${PORT}`);
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
