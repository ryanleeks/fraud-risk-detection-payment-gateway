// Import required packages
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize database (this will create the users table)
const db = require('./database');

// Create Express app
const app = express();

// Middleware - These help our server understand requests
app.use(cors()); // Allow frontend to talk to backend

// Stripe webhook needs raw body BEFORE express.json()
const wallet = require('./wallet');
app.post('/api/webhook/stripe', express.raw({type: 'application/json'}), wallet.handleStripeWebhook);

// Now parse JSON for other routes
app.use(express.json()); // Understand JSON data

// Simple test route to check if server is working
app.get('/', (req, res) => {
  res.json({
    message: 'Fraud Detection API is running!',
    status: 'OK'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
const auth = require('./auth');
app.post('/api/auth/signup', auth.signup);
app.post('/api/auth/login', auth.login);
app.post('/api/auth/verify-2fa', auth.verify2FA);

// User profile routes (protected - require authentication)
const user = require('./user');
const { verifyToken } = require('./middleware');
app.get('/api/user/profile', verifyToken, user.getProfile);
app.put('/api/user/profile', verifyToken, user.updateProfile);
app.put('/api/user/phone', verifyToken, user.changePhoneNumber);
app.post('/api/user/terminate', verifyToken, user.terminateAccount);

// 2FA management routes (protected)
app.post('/api/user/2fa/toggle', verifyToken, user.toggle2FA);
app.put('/api/user/2fa/method', verifyToken, user.update2FAMethod);
app.post('/api/user/2fa/test', verifyToken, user.send2FATest);

// Payment routes (protected)
app.post('/api/payment/lookup-recipient', verifyToken, user.lookupRecipient);

// Split payment routes (protected)
const splitpay = require('./splitpay');
app.post('/api/splitpay/create', verifyToken, splitpay.createSplitPayment);
app.get('/api/splitpay/my-splits', verifyToken, splitpay.getMySplitPayments);
app.post('/api/splitpay/respond', verifyToken, splitpay.respondToSplitPayment);
app.post('/api/splitpay/pay', verifyToken, splitpay.payMyShare);
app.post('/api/splitpay/cancel', verifyToken, splitpay.cancelSplitPayment);

// Wallet routes (protected)
app.get('/api/wallet/balance', verifyToken, wallet.getWalletBalance);
app.post('/api/wallet/add-funds', verifyToken, wallet.createPaymentIntent);
app.get('/api/wallet/transactions', verifyToken, wallet.getTransactionHistory);
app.post('/api/wallet/send', verifyToken, wallet.sendMoney);

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📡 Ready to accept requests`);
});
