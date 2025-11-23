// Fraud Detection API Endpoints
// Provides access to fraud detection metrics and statistics

const fraudDetection = require('./fraud-detection');
const db = require('./database');

/**
 * Get fraud detection statistics for current user
 */
const getUserFraudStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const stats = await fraudDetection.getUserFraudStats(userId);

    res.status(200).json({
      success: true,
      stats: {
        totalChecks: stats.total_checks || 0,
        averageRiskScore: stats.avg_risk_score ? parseFloat(stats.avg_risk_score.toFixed(2)) : 0,
        maxRiskScore: stats.max_risk_score || 0,
        blockedTransactions: stats.blocked_count || 0,
        reviewedTransactions: stats.review_count || 0,
        criticalRiskCount: stats.critical_count || 0,
        highRiskCount: stats.high_count || 0
      }
    });
  } catch (error) {
    console.error('Get user fraud stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fraud statistics'
    });
  }
};

/**
 * Get system-wide fraud detection metrics (admin only)
 */
const getSystemMetrics = async (req, res) => {
  try {
    const metrics = await fraudDetection.getSystemMetrics();

    res.status(200).json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Get system metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system metrics'
    });
  }
};

/**
 * Get recent fraud detection logs for user
 */
const getRecentFraudLogs = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const logs = db.prepare(`
      SELECT
        id,
        transaction_type,
        amount,
        risk_score,
        risk_level,
        action_taken,
        rules_triggered,
        created_at
      FROM fraud_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, parseInt(limit));

    // Parse JSON rules
    const parsedLogs = logs.map(log => ({
      ...log,
      rules_triggered: log.rules_triggered ? JSON.parse(log.rules_triggered) : []
    }));

    res.status(200).json({
      success: true,
      logs: parsedLogs
    });
  } catch (error) {
    console.error('Get fraud logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fraud logs'
    });
  }
};

module.exports = {
  getUserFraudStats,
  getSystemMetrics,
  getRecentFraudLogs
};
