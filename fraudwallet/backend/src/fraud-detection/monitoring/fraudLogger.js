// Fraud Detection Logging and Monitoring
// Logs all fraud checks for analysis and metrics

const db = require('../../database');

/**
 * Log a fraud check result
 * @param {Object} transaction - Transaction details
 * @param {Object} fraudResult - Fraud detection result
 */
const logFraudCheck = async (transaction, fraudResult) => {
  try {
    // Create fraud_logs table if it doesn't exist
    createFraudLogsTable();

    // Extract AI data if available
    const aiAnalysis = fraudResult.aiAnalysis || {};
    const ruleAnalysis = fraudResult.ruleBasedAnalysis || {};

    // Insert fraud check log with AI data
    db.prepare(`
      INSERT INTO fraud_logs (
        user_id,
        transaction_type,
        amount,
        risk_score,
        risk_level,
        action_taken,
        rules_triggered,
        execution_time_ms,
        rule_based_score,
        ai_risk_score,
        ai_confidence,
        ai_reasoning,
        ai_red_flags,
        ai_response_time,
        detection_method,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      transaction.userId,
      transaction.type,
      transaction.amount,
      fraudResult.riskScore,
      fraudResult.riskLevel,
      fraudResult.action,
      JSON.stringify((fraudResult.triggeredRules || ruleAnalysis.triggeredRules || []).map(r => r.ruleId || r)),
      fraudResult.executionTime,
      ruleAnalysis.score || fraudResult.riskScore,
      aiAnalysis.riskScore || null,
      aiAnalysis.confidence || null,
      aiAnalysis.reasoning || null,
      JSON.stringify(aiAnalysis.redFlags || []),
      aiAnalysis.responseTime || null,
      fraudResult.detectionMethod || 'rules'
    );

    // Log to console for real-time monitoring
    if (fraudResult.riskScore >= 60) {
      console.log(`🚨 HIGH RISK TRANSACTION DETECTED`);
      console.log(`   User: ${transaction.userId}`);
      console.log(`   Amount: RM${transaction.amount.toFixed(2)}`);
      console.log(`   Risk Score: ${fraudResult.riskScore}/100 (${fraudResult.riskLevel})`);
      console.log(`   Action: ${fraudResult.action}`);
      console.log(`   Detection: ${fraudResult.detectionMethod || 'rules'}`);

      if (ruleAnalysis.triggeredRules) {
        console.log(`   Rules: ${ruleAnalysis.triggeredRules.map(r => r.ruleId || r).join(', ')}`);
      }

      if (aiAnalysis.reasoning) {
        console.log(`   AI Analysis: ${aiAnalysis.reasoning}`);
      }
    } else if (fraudResult.riskScore >= 40) {
      console.log(`⚠️  MEDIUM RISK: User ${transaction.userId}, Score: ${fraudResult.riskScore}/100 (${fraudResult.detectionMethod || 'rules'})`);
    }

  } catch (error) {
    console.error('Fraud logging error:', error);
  }
};

/**
 * Get fraud statistics for a specific user
 * @param {number} userId - User ID
 * @returns {Object} User fraud statistics
 */
const getUserStats = async (userId) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_checks,
        AVG(risk_score) as avg_risk_score,
        MAX(risk_score) as max_risk_score,
        SUM(CASE WHEN action_taken = 'BLOCK' THEN 1 ELSE 0 END) as blocked_count,
        SUM(CASE WHEN action_taken = 'REVIEW' THEN 1 ELSE 0 END) as review_count,
        SUM(CASE WHEN risk_level = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_count
      FROM fraud_logs
      WHERE user_id = ?
    `).get(userId);

    return stats || {};
  } catch (error) {
    console.error('Get user stats error:', error);
    return {};
  }
};

/**
 * Get system-wide fraud detection metrics
 * @returns {Object} System metrics
 */
const getSystemMetrics = async () => {
  try {
    const overall = db.prepare(`
      SELECT
        COUNT(*) as total_checks,
        AVG(risk_score) as avg_risk_score,
        AVG(execution_time_ms) as avg_execution_time,
        SUM(CASE WHEN action_taken = 'BLOCK' THEN 1 ELSE 0 END) as total_blocked,
        SUM(CASE WHEN action_taken = 'REVIEW' THEN 1 ELSE 0 END) as total_review,
        SUM(CASE WHEN action_taken = 'ALLOW' THEN 1 ELSE 0 END) as total_allowed
      FROM fraud_logs
      WHERE created_at > datetime('now', '-24 hours')
    `).get();

    const byLevel = db.prepare(`
      SELECT
        risk_level,
        COUNT(*) as count
      FROM fraud_logs
      WHERE created_at > datetime('now', '-24 hours')
      GROUP BY risk_level
    `).all();

    const topRules = db.prepare(`
      SELECT
        rules_triggered,
        COUNT(*) as frequency
      FROM fraud_logs
      WHERE created_at > datetime('now', '-7 days')
      AND rules_triggered != '[]'
      GROUP BY rules_triggered
      ORDER BY frequency DESC
      LIMIT 10
    `).all();

    return {
      last24Hours: overall,
      riskLevelDistribution: byLevel,
      topTriggeredRules: topRules,
      detectionRate: overall.total_checks > 0
        ? ((overall.total_blocked + overall.total_review) / overall.total_checks * 100).toFixed(2)
        : 0
    };
  } catch (error) {
    console.error('Get system metrics error:', error);
    return {};
  }
};

/**
 * Get recent high-risk transactions
 * @param {number} limit - Number of records to return
 * @returns {Array} Recent high-risk transactions
 */
const getRecentHighRiskTransactions = (limit = 20) => {
  try {
    return db.prepare(`
      SELECT
        fl.*,
        u.full_name,
        u.account_id
      FROM fraud_logs fl
      JOIN users u ON fl.user_id = u.id
      WHERE fl.risk_score >= 60
      ORDER BY fl.created_at DESC
      LIMIT ?
    `).all(limit);
  } catch (error) {
    console.error('Get recent high-risk transactions error:', error);
    return [];
  }
};

/**
 * Create fraud_logs table if it doesn't exist
 */
const createFraudLogsTable = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS fraud_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        amount REAL NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        action_taken TEXT NOT NULL,
        rules_triggered TEXT,
        execution_time_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create index for faster queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_user_id ON fraud_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_created_at ON fraud_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_risk_score ON fraud_logs(risk_score);
    `);

    // Add AI columns if they don't exist (migration for existing databases)
    try {
      const columns = db.prepare("PRAGMA table_info(fraud_logs)").all();
      const columnNames = columns.map(col => col.name);

      if (!columnNames.includes('rule_based_score')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN rule_based_score INTEGER");
        console.log('✅ Added rule_based_score column to fraud_logs');
      }

      if (!columnNames.includes('ai_risk_score')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN ai_risk_score INTEGER");
        console.log('✅ Added ai_risk_score column to fraud_logs');
      }

      if (!columnNames.includes('ai_confidence')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN ai_confidence INTEGER");
        console.log('✅ Added ai_confidence column to fraud_logs');
      }

      if (!columnNames.includes('ai_reasoning')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN ai_reasoning TEXT");
        console.log('✅ Added ai_reasoning column to fraud_logs');
      }

      if (!columnNames.includes('ai_red_flags')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN ai_red_flags TEXT");
        console.log('✅ Added ai_red_flags column to fraud_logs');
      }

      if (!columnNames.includes('ai_response_time')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN ai_response_time INTEGER");
        console.log('✅ Added ai_response_time column to fraud_logs');
      }

      if (!columnNames.includes('detection_method')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN detection_method TEXT DEFAULT 'rules'");
        console.log('✅ Added detection_method column to fraud_logs');
      }
    } catch (error) {
      console.error('Error adding AI columns:', error.message);
    }
  } catch (error) {
    // Table might already exist, that's okay
  }
};

// Initialize table on module load
createFraudLogsTable();

module.exports = {
  logFraudCheck,
  getUserStats,
  getSystemMetrics,
  getRecentHighRiskTransactions
};
