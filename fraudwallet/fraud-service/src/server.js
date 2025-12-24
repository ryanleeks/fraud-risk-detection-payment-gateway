// Fraud Detection Microservice
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./database');
const fraudDetection = require('./fraud-detection');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'fraud-detection',
    timestamp: new Date().toISOString()
  });
});

// Main fraud check endpoint
app.post('/check-transaction', async (req, res) => {
  try {
    const { userId, transactionType, amount, recipientId } = req.body;

    if (!userId || !transactionType || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, transactionType, amount'
      });
    }

    console.log(`🔍 Checking transaction: User ${userId}, Type: ${transactionType}, Amount: ${amount}`);

    // Run fraud detection
    const result = await fraudDetection.checkTransaction({
      userId,
      transactionType,
      amount,
      recipientId
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Fraud check error:', error);
    res.status(500).json({
      success: false,
      error: 'Fraud detection service error',
      message: error.message
    });
  }
});

// Get user fraud stats
app.get('/user-stats/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    const stats = db.prepare(`
      SELECT
        COUNT(*) as totalChecks,
        AVG(risk_score) as averageRiskScore,
        MAX(risk_score) as maxRiskScore,
        SUM(CASE WHEN action_taken = 'BLOCK' THEN 1 ELSE 0 END) as blockedTransactions,
        SUM(CASE WHEN action_taken = 'REVIEW' THEN 1 ELSE 0 END) as reviewedTransactions,
        SUM(CASE WHEN risk_level = 'CRITICAL' THEN 1 ELSE 0 END) as criticalRiskCount,
        SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as highRiskCount
      FROM fraud_logs
      WHERE user_id = ?
    `).get(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error getting user stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get high-risk users
app.get('/high-risk-users', (req, res) => {
  try {
    const { limit = 10, minScore = 60 } = req.query;

    const users = db.prepare(`
      SELECT
        fl.user_id,
        u.full_name,
        u.account_id,
        fl.risk_score,
        fl.risk_level,
        fl.action_taken,
        fl.amount,
        fl.transaction_type,
        fl.rules_triggered,
        fl.created_at
      FROM fraud_logs fl
      JOIN users u ON fl.user_id = u.id
      WHERE fl.risk_score >= ?
      ORDER BY fl.risk_score DESC, fl.created_at DESC
      LIMIT ?
    `).all(minScore, parseInt(limit));

    res.json({
      success: true,
      count: users.length,
      highRiskUsers: users.map(u => ({
        ...u,
        rules_triggered: JSON.parse(u.rules_triggered || '[]')
      }))
    });
  } catch (error) {
    console.error('❌ Error getting high-risk users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get system metrics
app.get('/system-metrics', (req, res) => {
  try {
    const metrics = db.prepare(`
      SELECT
        COUNT(*) as totalChecks,
        AVG(risk_score) as avgRiskScore,
        SUM(CASE WHEN action_taken = 'BLOCK' THEN 1 ELSE 0 END) as totalBlocked,
        SUM(CASE WHEN action_taken = 'REVIEW' THEN 1 ELSE 0 END) as totalReviewed,
        SUM(CASE WHEN risk_level = 'CRITICAL' THEN 1 ELSE 0 END) as criticalCount,
        SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as highCount
      FROM fraud_logs
      WHERE created_at >= datetime('now', '-7 days')
    `).get();

    res.json({
      success: true,
      metrics,
      period: 'last_7_days'
    });
  } catch (error) {
    console.error('❌ Error getting system metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent fraud logs
app.get('/recent-logs', (req, res) => {
  try {
    const { limit = 20, userId } = req.query;

    let query = `
      SELECT * FROM fraud_logs
      ${userId ? 'WHERE user_id = ?' : ''}
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const logs = userId
      ? db.prepare(query).all(userId, parseInt(limit))
      : db.prepare(query).all(parseInt(limit));

    res.json({
      success: true,
      logs: logs.map(log => ({
        ...log,
        rules_triggered: JSON.parse(log.rules_triggered || '[]')
      }))
    });
  } catch (error) {
    console.error('❌ Error getting recent logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 8085;
app.listen(PORT, () => {
  console.log(`🔍 Fraud Detection Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
