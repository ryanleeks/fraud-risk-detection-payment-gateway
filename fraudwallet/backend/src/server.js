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
const { verifyToken, verifyAdminToken } = require('./middleware');
app.get('/api/user/profile', verifyToken, user.getProfile);
app.put('/api/user/profile', verifyToken, user.updateProfile);
app.put('/api/user/phone', verifyToken, user.changePhoneNumber);
app.post('/api/user/terminate', verifyToken, user.terminateAccount);

// 2FA management routes (protected)
app.post('/api/user/2fa/toggle', verifyToken, user.toggle2FA);
app.post('/api/user/2fa/send-disable-code', verifyToken, user.sendDisableCode);
app.put('/api/user/2fa/method', verifyToken, user.update2FAMethod);
app.post('/api/user/2fa/test', verifyToken, user.send2FATest);

// Transaction passcode routes (protected)
const passcodeAPI = require('./passcodeAPI');
app.post('/api/user/passcode/set', verifyToken, passcodeAPI.setUserPasscode);
app.post('/api/user/passcode/verify', verifyToken, passcodeAPI.verifyUserPasscode);
app.post('/api/user/passcode/change', verifyToken, passcodeAPI.changeUserPasscode);
app.get('/api/user/passcode/status', verifyToken, passcodeAPI.getUserPasscodeStatus);

// Payment routes (protected)
app.post('/api/payment/lookup-recipient', verifyToken, user.lookupRecipient);

// Timezone route (protected)
app.get('/api/user/timezone', verifyToken, user.getUserTimezone);

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

// Fraud Detection routes (protected)
const fraudAPI = require('./fraudDetectionAPI');
app.get('/api/fraud/user-stats', verifyToken, fraudAPI.getUserFraudStats);
app.get('/api/fraud/system-metrics', verifyToken, fraudAPI.getSystemMetrics);
app.get('/api/fraud/system-health', verifyToken, fraudAPI.getSystemHealth);
app.get('/api/fraud/recent-logs', verifyToken, fraudAPI.getRecentFraudLogs);
app.get('/api/fraud/high-risk-users', verifyToken, fraudAPI.getHighRiskUsers);
app.get('/api/fraud/top-flagged-users', verifyToken, fraudAPI.getTopFlaggedUsers);
app.get('/api/fraud/user/:userId', verifyToken, fraudAPI.getUserFraudDetails);

// AI-Enhanced Fraud Detection routes
app.get('/api/fraud/ai-logs', verifyToken, fraudAPI.getAIFraudLogs);
app.get('/api/fraud/ai-metrics', verifyToken, fraudAPI.getAIMetrics);
app.get('/api/fraud/ai-disagreements', verifyToken, fraudAPI.getDisagreementCases);

// Academic Metrics routes (Admin only - for final year project)
app.post('/api/fraud/verify/:logId', verifyAdminToken, fraudAPI.verifyGroundTruth);
app.get('/api/fraud/unverified-logs', verifyAdminToken, fraudAPI.getUnverifiedLogs);
app.get('/api/fraud/verified-logs', verifyAdminToken, fraudAPI.getVerifiedLogs);
app.get('/api/fraud/academic-metrics', verifyAdminToken, fraudAPI.getAcademicMetrics);
app.get('/api/fraud/confusion-matrix', verifyAdminToken, fraudAPI.getConfusionMatrix);
app.get('/api/fraud/metrics-history', verifyAdminToken, fraudAPI.getMetricsHistory);
app.get('/api/fraud/error-analysis', verifyAdminToken, fraudAPI.getErrorAnalysis);
app.get('/api/fraud/threshold-analysis', verifyAdminToken, fraudAPI.getThresholdAnalysis);
app.get('/api/fraud/export-dataset', verifyAdminToken, fraudAPI.exportDataset);

// Auto-approval routes
app.post('/api/fraud/revoke/:logId', verifyAdminToken, fraudAPI.revokeAutoApproval);
app.post('/api/fraud/trigger-auto-approval', verifyAdminToken, fraudAPI.triggerAutoApproval);

// Appeals routes
app.post('/api/fraud/appeal/:logId', verifyToken, fraudAPI.submitAppeal);
app.get('/api/fraud/appeals/pending', verifyAdminToken, fraudAPI.getPendingAppeals);
app.get('/api/fraud/appeals/my-appeals', verifyToken, fraudAPI.getUserAppeals);
app.post('/api/fraud/appeals/:appealId/resolve', verifyAdminToken, fraudAPI.resolveAppeal);
app.get('/api/fraud/my-flags', verifyToken, fraudAPI.getUserFraudFlags);

// Admin routes (Admin only)
const adminAPI = require('./adminAPI');
app.get('/api/admin/users', verifyAdminToken, adminAPI.getAllUsers);
app.get('/api/admin/users/:userId', verifyAdminToken, adminAPI.getUserById);
app.patch('/api/admin/users/:userId/status', verifyAdminToken, adminAPI.updateUserStatus);
app.patch('/api/admin/users/:userId/password', verifyAdminToken, adminAPI.resetUserPassword);

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📡 Ready to accept requests`);
});

