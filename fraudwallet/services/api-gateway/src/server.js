const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Service URLs
const SERVICES = {
  auth: process.env.AUTH_SERVICE || 'http://auth-service:3001',
  user: process.env.USER_SERVICE || 'http://user-service:3002',
  wallet: process.env.WALLET_SERVICE || 'http://wallet-service:3003',
  splitpay: process.env.SPLITPAY_SERVICE || 'http://splitpay-service:3004',
  fraud: process.env.FRAUD_DETECTION_SERVICE || 'http://fraud-detection-service:3005'
};

// Proxy configuration
const proxyOptions = {
  changeOrigin: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    // Forward original IP
    proxyReq.setHeader('X-Forwarded-For', req.ip);
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable'
    });
  }
};

// Route to Auth Service
app.use('/api/auth', createProxyMiddleware({
  target: SERVICES.auth,
  ...proxyOptions
}));

// Route to User Service
app.use('/api/user', createProxyMiddleware({
  target: SERVICES.user,
  ...proxyOptions
}));

// Route to Wallet Service
app.use('/api/wallet', createProxyMiddleware({
  target: SERVICES.wallet,
  ...proxyOptions
}));

// Route Stripe webhook directly to wallet service (preserve raw body)
app.use('/api/webhook/stripe', createProxyMiddleware({
  target: SERVICES.wallet,
  ...proxyOptions
}));

// Route to SplitPay Service
app.use('/api/splitpay', createProxyMiddleware({
  target: SERVICES.splitpay,
  ...proxyOptions
}));

// Route to Fraud Detection Service
app.use('/api/fraud', createProxyMiddleware({
  target: SERVICES.fraud,
  ...proxyOptions
}));

// Payment lookup route (can go to user service)
app.use('/api/payment', createProxyMiddleware({
  target: SERVICES.user,
  ...proxyOptions
}));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`✅ API Gateway running on port ${PORT}`);
  console.log(`📡 Routing to microservices:`);
  console.log(`   - Auth Service: ${SERVICES.auth}`);
  console.log(`   - User Service: ${SERVICES.user}`);
  console.log(`   - Wallet Service: ${SERVICES.wallet}`);
  console.log(`   - SplitPay Service: ${SERVICES.splitpay}`);
  console.log(`   - Fraud Detection: ${SERVICES.fraud}`);
});

module.exports = app;
