const express = require('express');
const cors = require('cors');
require('dotenv').config();

const database = require('../../shared/database/postgres');
const Logger = require('../../shared/utils/logger');
const { verifyToken } = require('../../shared/middleware/auth');
const walletController = require('./controllers/walletController');
const stripeController = require('./controllers/stripeController');

const logger = new Logger('wallet-service');
const app = express();

// Middleware
app.use(cors());

// Stripe webhook needs raw body BEFORE express.json()
app.post('/api/webhook/stripe', express.raw({type: 'application/json'}), stripeController.handleWebhook);

// Now parse JSON for other routes
app.use(express.json());
app.use(logger.requestLogger());

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'wallet-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Wallet routes (protected)
app.get('/api/wallet/balance', verifyToken, walletController.getBalance);
app.post('/api/wallet/add-funds', verifyToken, stripeController.createPaymentIntent);
app.get('/api/wallet/transactions', verifyToken, walletController.getTransactionHistory);
app.post('/api/wallet/send', verifyToken, walletController.sendMoney);

// Internal route for split payments (called by splitpay service)
app.post('/api/wallet/internal/deduct', walletController.deductFunds);
app.post('/api/wallet/internal/credit', walletController.creditFunds);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 3003;

async function startServer() {
  try {
    await database.initialize();
    logger.info('Database connected');

    app.listen(PORT, () => {
      logger.info(`Wallet Service running on port ${PORT}`);
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
