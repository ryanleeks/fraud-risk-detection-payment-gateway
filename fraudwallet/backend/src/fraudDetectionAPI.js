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

/**
 * Get high-risk users and transactions
 */
const getHighRiskUsers = async (req, res) => {
  try {
    const { limit = 20, minScore = 60 } = req.query;

    const highRiskUsers = db.prepare(`
      SELECT
        u.id as user_id,
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
      ORDER BY fl.created_at DESC
      LIMIT ?
    `).all(parseInt(minScore), parseInt(limit));

    // Parse JSON rules
    const parsedUsers = highRiskUsers.map(user => ({
      ...user,
      rules_triggered: user.rules_triggered ? JSON.parse(user.rules_triggered) : []
    }));

    res.status(200).json({
      success: true,
      count: parsedUsers.length,
      highRiskUsers: parsedUsers
    });
  } catch (error) {
    console.error('Get high-risk users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching high-risk users'
    });
  }
};

/**
 * Get top flagged users
 */
const getTopFlaggedUsers = async (req, res) => {
  try {
    const { limit = 10, days = 7 } = req.query;

    const topUsers = db.prepare(`
      SELECT
        u.id as user_id,
        u.full_name,
        u.account_id,
        u.email,
        COUNT(*) as total_flags,
        AVG(fl.risk_score) as avg_risk_score,
        MAX(fl.risk_score) as max_risk_score,
        SUM(CASE WHEN fl.action_taken = 'BLOCK' THEN 1 ELSE 0 END) as blocked_count,
        SUM(CASE WHEN fl.action_taken = 'REVIEW' THEN 1 ELSE 0 END) as review_count,
        MAX(fl.created_at) as last_flagged
      FROM fraud_logs fl
      JOIN users u ON fl.user_id = u.id
      WHERE fl.created_at > datetime('now', '-' || ? || ' days')
      GROUP BY u.id
      ORDER BY avg_risk_score DESC
      LIMIT ?
    `).all(parseInt(days), parseInt(limit));

    res.status(200).json({
      success: true,
      count: topUsers.length,
      topFlaggedUsers: topUsers.map(u => ({
        ...u,
        avg_risk_score: parseFloat(u.avg_risk_score.toFixed(2))
      }))
    });
  } catch (error) {
    console.error('Get top flagged users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top flagged users'
    });
  }
};

/**
 * Get fraud statistics for a specific user (admin view)
 */
const getUserFraudDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user info
    const user = db.prepare('SELECT id, full_name, account_id, email, created_at FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get fraud stats
    const stats = await fraudDetection.getUserFraudStats(userId);

    // Get recent logs
    const recentLogs = db.prepare(`
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
      LIMIT 20
    `).all(userId);

    res.status(200).json({
      success: true,
      user: user,
      stats: stats,
      recentLogs: recentLogs.map(log => ({
        ...log,
        rules_triggered: log.rules_triggered ? JSON.parse(log.rules_triggered) : []
      }))
    });
  } catch (error) {
    console.error('Get user fraud details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user fraud details'
    });
  }
};

/**
 * Get AI-enhanced fraud logs with AI analysis
 */
const getAIFraudLogs = async (req, res) => {
  try {
    const { limit = 20, minScore = 0 } = req.query;

    const logs = db.prepare(`
      SELECT
        fl.*,
        u.full_name,
        u.account_id
      FROM fraud_logs fl
      JOIN users u ON fl.user_id = u.id
      WHERE fl.detection_method = 'hybrid'
      AND fl.risk_score >= ?
      ORDER BY fl.created_at DESC
      LIMIT ?
    `).all(parseInt(minScore), parseInt(limit));

    const parsedLogs = logs.map(log => ({
      ...log,
      rules_triggered: log.rules_triggered ? JSON.parse(log.rules_triggered) : [],
      ai_red_flags: log.ai_red_flags ? JSON.parse(log.ai_red_flags) : []
    }));

    res.status(200).json({
      success: true,
      count: parsedLogs.length,
      logs: parsedLogs
    });
  } catch (error) {
    console.error('Get AI fraud logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching AI fraud logs'
    });
  }
};

/**
 * Get AI detection metrics and performance
 */
const getAIMetrics = async (req, res) => {
  try {
    // Overall AI usage
    const aiUsage = db.prepare(`
      SELECT
        COUNT(*) as total_ai_checks,
        AVG(ai_risk_score) as avg_ai_score,
        AVG(ai_confidence) as avg_confidence,
        AVG(ai_response_time) as avg_response_time,
        COUNT(CASE WHEN detection_method = 'hybrid' THEN 1 END) as hybrid_count,
        COUNT(CASE WHEN detection_method = 'rules' THEN 1 END) as rules_only_count
      FROM fraud_logs
      WHERE created_at > datetime('now', '-24 hours')
    `).get();

    // AI vs Rules comparison
    const comparison = db.prepare(`
      SELECT
        AVG(CASE WHEN detection_method = 'hybrid' THEN risk_score END) as avg_hybrid_score,
        AVG(CASE WHEN detection_method = 'rules' THEN risk_score END) as avg_rules_score,
        AVG(CASE WHEN detection_method = 'hybrid' THEN ABS(rule_based_score - ai_risk_score) END) as avg_score_difference
      FROM fraud_logs
      WHERE created_at > datetime('now', '-7 days')
    `).get();

    // AI detection rate
    const detectionStats = db.prepare(`
      SELECT
        detection_method,
        action_taken,
        COUNT(*) as count
      FROM fraud_logs
      WHERE created_at > datetime('now', '-24 hours')
      GROUP BY detection_method, action_taken
    `).all();

    res.status(200).json({
      success: true,
      metrics: {
        usage: {
          totalAIChecks: aiUsage.total_ai_checks || 0,
          avgAIScore: aiUsage.avg_ai_score ? parseFloat(aiUsage.avg_ai_score.toFixed(2)) : 0,
          avgConfidence: aiUsage.avg_confidence ? parseFloat(aiUsage.avg_confidence.toFixed(2)) : 0,
          avgResponseTime: aiUsage.avg_response_time ? parseFloat(aiUsage.avg_response_time.toFixed(2)) : 0,
          hybridCount: aiUsage.hybrid_count || 0,
          rulesOnlyCount: aiUsage.rules_only_count || 0
        },
        comparison: {
          avgHybridScore: comparison.avg_hybrid_score ? parseFloat(comparison.avg_hybrid_score.toFixed(2)) : 0,
          avgRulesScore: comparison.avg_rules_score ? parseFloat(comparison.avg_rules_score.toFixed(2)) : 0,
          avgScoreDifference: comparison.avg_score_difference ? parseFloat(comparison.avg_score_difference.toFixed(2)) : 0
        },
        detectionStats: detectionStats
      }
    });
  } catch (error) {
    console.error('Get AI metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching AI metrics'
    });
  }
};

/**
 * Get cases where AI and rules disagreed
 */
const getDisagreementCases = async (req, res) => {
  try {
    const { threshold = 30, limit = 20 } = req.query;

    const disagreements = db.prepare(`
      SELECT
        fl.*,
        u.full_name,
        u.account_id,
        ABS(fl.rule_based_score - fl.ai_risk_score) as score_difference
      FROM fraud_logs fl
      JOIN users u ON fl.user_id = u.id
      WHERE fl.detection_method = 'hybrid'
      AND ABS(fl.rule_based_score - fl.ai_risk_score) >= ?
      ORDER BY score_difference DESC
      LIMIT ?
    `).all(parseInt(threshold), parseInt(limit));

    const parsedDisagreements = disagreements.map(log => ({
      ...log,
      rules_triggered: log.rules_triggered ? JSON.parse(log.rules_triggered) : [],
      ai_red_flags: log.ai_red_flags ? JSON.parse(log.ai_red_flags) : []
    }));

    res.status(200).json({
      success: true,
      count: parsedDisagreements.length,
      disagreements: parsedDisagreements
    });
  } catch (error) {
    console.error('Get disagreement cases error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching disagreement cases'
    });
  }
};

module.exports = {
  getUserFraudStats,
  getSystemMetrics,
  getRecentFraudLogs,
  getHighRiskUsers,
  getTopFlaggedUsers,
  getUserFraudDetails,
  // New AI endpoints
  getAIFraudLogs,
  getAIMetrics,
  getDisagreementCases
};
