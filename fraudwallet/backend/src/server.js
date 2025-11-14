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

// User profile routes (protected - require authentication)
const user = require('./user');
const { verifyToken } = require('./middleware');
app.get('/api/user/profile', verifyToken, user.getProfile);
app.put('/api/user/profile', verifyToken, user.updateProfile);
app.post('/api/user/terminate', verifyToken, user.terminateAccount);

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📡 Ready to accept requests`);
});
