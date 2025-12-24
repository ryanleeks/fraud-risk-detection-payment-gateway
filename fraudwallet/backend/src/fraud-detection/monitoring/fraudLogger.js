// Fraud Detection Logging and Monitoring
// Logs all fraud checks for analysis and metrics

const db = require('../../database');
const healthRegeneration = require('../utils/healthRegeneration');

/**
 * Log a fraud check result
 * @param {Object} transaction - Transaction details
 * @param {Object} fraudResult - Fraud detection result
 * @returns {number|null} The fraud log ID, or null if logging failed
 */
const logFraudCheck = async (transaction, fraudResult) => {
  try {
    // Create fraud_logs table if it doesn't exist
    createFraudLogsTable();

    // Extract AI data if available
    const aiAnalysis = fraudResult.aiAnalysis || {};
    const ruleAnalysis = fraudResult.ruleBasedAnalysis || {};

    // Extract location data if available
    const locationData = transaction.locationData || {};

    // Extract recipient data if available
    const recipientData = transaction.recipientData || {};

    // Insert fraud check log with AI, location, and recipient data
    const result = db.prepare(`
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
        ip_address,
        country,
        city,
        latitude,
        longitude,
        location_changed,
        recipient_id,
        recipient_name,
        recipient_account_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
      fraudResult.detectionMethod || 'rules',
      locationData.ip || null,
      locationData.country || null,
      locationData.city || null,
      locationData.latitude || null,
      locationData.longitude || null,
      locationData.locationChanged ? 1 : 0,
      recipientData.id || null,
      recipientData.name || null,
      recipientData.accountId || null
    );

    const logId = result.lastInsertRowid;

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

    return logId;

  } catch (error) {
    console.error('Fraud logging error:', error);
    return null;
  }
};

/**
 * Get fraud statistics for a specific user
 * NOW WITH TIME-WEIGHTED HEALTH REGENERATION!
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
        SUM(CASE WHEN UPPER(action_taken) = 'BLOCK' THEN 1 ELSE 0 END) as blocked_count,
        SUM(CASE WHEN UPPER(action_taken) = 'REVIEW' THEN 1 ELSE 0 END) as review_count,
        SUM(CASE WHEN UPPER(risk_level) = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN UPPER(risk_level) = 'HIGH' THEN 1 ELSE 0 END) as high_count
      FROM fraud_logs
      WHERE user_id = ?
    `).get(userId);

    // Calculate time-weighted health score (NEW!)
    const healthData = healthRegeneration.calculateTimeWeightedHealthScore(userId);

    // Get health recovery estimate
    const recoveryEstimate = healthRegeneration.getHealthRecoveryEstimate(userId, 20);

    // Get health trend
    const healthTrend = healthRegeneration.getHealthScoreTrend(userId);

    // Combine traditional stats with new health data
    return {
      ...stats,
      // Replace simple average with time-weighted health score
      avg_risk_score: healthData.healthScore || stats.avg_risk_score || 0,
      // Keep original simple average for comparison
      simple_avg_risk_score: stats.avg_risk_score || 0,
      // Add health regeneration data
      health: {
        score: healthData.healthScore,
        simpleAverage: healthData.simpleAverage,
        improvement: healthData.improvement, // How much better than simple average
        transactionCount: healthData.transactionCount,
        method: healthData.method,
        dateRange: healthData.dateRange,
        config: healthData.config
      },
      // Add recovery estimate
      recovery: {
        recovered: recoveryEstimate.recovered,
        currentScore: recoveryEstimate.currentScore,
        targetScore: recoveryEstimate.targetScore,
        estimatedDays: recoveryEstimate.estimatedDays,
        estimatedWeeks: recoveryEstimate.estimatedWeeks,
        message: recoveryEstimate.message,
        advice: recoveryEstimate.advice
      },
      // Add trend data
      trend: healthTrend.trend,
      improving: healthTrend.improving
    };
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

      // Ground truth tracking columns for academic metrics
      if (!columnNames.includes('ground_truth')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN ground_truth TEXT");
        console.log('✅ Added ground_truth column to fraud_logs');
      }

      if (!columnNames.includes('verified_at')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN verified_at DATETIME");
        console.log('✅ Added verified_at column to fraud_logs');
      }

      if (!columnNames.includes('verified_by')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN verified_by INTEGER");
        console.log('✅ Added verified_by column to fraud_logs');
      }

      if (!columnNames.includes('is_true_positive')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN is_true_positive INTEGER");
        console.log('✅ Added is_true_positive column to fraud_logs');
      }

      if (!columnNames.includes('is_false_positive')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN is_false_positive INTEGER");
        console.log('✅ Added is_false_positive column to fraud_logs');
      }

      if (!columnNames.includes('is_true_negative')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN is_true_negative INTEGER");
        console.log('✅ Added is_true_negative column to fraud_logs');
      }

      if (!columnNames.includes('is_false_negative')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN is_false_negative INTEGER");
        console.log('✅ Added is_false_negative column to fraud_logs');
      }

      // IP address and geolocation columns
      if (!columnNames.includes('ip_address')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN ip_address TEXT");
        console.log('✅ Added ip_address column to fraud_logs');
      }

      if (!columnNames.includes('country')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN country TEXT");
        console.log('✅ Added country column to fraud_logs');
      }

      if (!columnNames.includes('city')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN city TEXT");
        console.log('✅ Added city column to fraud_logs');
      }

      if (!columnNames.includes('latitude')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN latitude REAL");
        console.log('✅ Added latitude column to fraud_logs');
      }

      if (!columnNames.includes('longitude')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN longitude REAL");
        console.log('✅ Added longitude column to fraud_logs');
      }

      if (!columnNames.includes('location_changed')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN location_changed INTEGER DEFAULT 0");
        console.log('✅ Added location_changed column to fraud_logs');
      }

      // Recipient/transaction party columns
      if (!columnNames.includes('recipient_id')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN recipient_id INTEGER");
        console.log('✅ Added recipient_id column to fraud_logs');
      }

      if (!columnNames.includes('recipient_name')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN recipient_name TEXT");
        console.log('✅ Added recipient_name column to fraud_logs');
      }

      if (!columnNames.includes('recipient_account_id')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN recipient_account_id TEXT");
        console.log('✅ Added recipient_account_id column to fraud_logs');
      }

      // Auto-approval system columns
      if (!columnNames.includes('auto_approved_at')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN auto_approved_at DATETIME");
        console.log('✅ Added auto_approved_at column to fraud_logs');
      }

      if (!columnNames.includes('auto_approval_source')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN auto_approval_source TEXT");
        console.log('✅ Added auto_approval_source column to fraud_logs');
      }

      if (!columnNames.includes('revoked_at')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN revoked_at DATETIME");
        console.log('✅ Added revoked_at column to fraud_logs');
      }

      if (!columnNames.includes('revoked_by')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN revoked_by INTEGER");
        console.log('✅ Added revoked_by column to fraud_logs');
      }

      if (!columnNames.includes('revoked_reason')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN revoked_reason TEXT");
        console.log('✅ Added revoked_reason column to fraud_logs');
      }

      // Admin review status for the new workflow
      if (!columnNames.includes('admin_review_status')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN admin_review_status TEXT DEFAULT 'pending'");
        console.log('✅ Added admin_review_status column to fraud_logs');
      }

      if (!columnNames.includes('admin_reviewed_at')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN admin_reviewed_at DATETIME");
        console.log('✅ Added admin_reviewed_at column to fraud_logs');
      }

      if (!columnNames.includes('admin_reviewed_by')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN admin_reviewed_by INTEGER");
        console.log('✅ Added admin_reviewed_by column to fraud_logs');
      }

      if (!columnNames.includes('appeal_status')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN appeal_status TEXT DEFAULT 'none'");
        console.log('✅ Added appeal_status column to fraud_logs');
      }

      if (!columnNames.includes('appealed_at')) {
        db.exec("ALTER TABLE fraud_logs ADD COLUMN appealed_at DATETIME");
        console.log('✅ Added appealed_at column to fraud_logs');
      }
    } catch (error) {
      console.error('Error adding AI columns:', error.message);
    }
  } catch (error) {
    // Table might already exist, that's okay
  }
};

/**
 * Create fraud_appeals table if it doesn't exist
 */
const createFraudAppealsTable = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS fraud_appeals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fraud_log_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_by INTEGER,
        admin_notes TEXT,
        FOREIGN KEY (fraud_log_id) REFERENCES fraud_logs(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (resolved_by) REFERENCES users(id)
      )
    `);

    // Create index for faster queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_fraud_appeals_user_id ON fraud_appeals(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_appeals_fraud_log_id ON fraud_appeals(fraud_log_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_appeals_status ON fraud_appeals(status);
    `);

    console.log('✅ Fraud appeals table is ready');
  } catch (error) {
    // Table might already exist, that's okay
  }
};

/**
 * Verify ground truth for a fraud log entry
 * Updates confusion matrix classifications
 * @param {number} logId - Fraud log ID
 * @param {string} groundTruth - 'fraud' or 'legitimate'
 * @param {number} verifiedBy - User ID of admin who verified
 * @returns {Object} Updated log entry
 */
const verifyGroundTruth = async (logId, groundTruth, verifiedBy) => {
  try {
    // Get the fraud log entry
    const log = db.prepare('SELECT * FROM fraud_logs WHERE id = ?').get(logId);

    if (!log) {
      throw new Error('Fraud log not found');
    }

    // Determine confusion matrix classification
    // Predicted: Based on action_taken (BLOCK/REVIEW = positive, ALLOW/CHALLENGE = negative)
    // Actual: Based on ground_truth

    const predictedPositive = log.action_taken === 'BLOCK' || log.action_taken === 'REVIEW';
    const actualPositive = groundTruth === 'fraud';

    let isTP = 0, isFP = 0, isTN = 0, isFN = 0;

    if (predictedPositive && actualPositive) {
      isTP = 1; // True Positive: Correctly identified fraud
    } else if (predictedPositive && !actualPositive) {
      isFP = 1; // False Positive: Incorrectly flagged legitimate as fraud
    } else if (!predictedPositive && !actualPositive) {
      isTN = 1; // True Negative: Correctly allowed legitimate
    } else if (!predictedPositive && actualPositive) {
      isFN = 1; // False Negative: Missed fraud (allowed it through)
    }

    // Update the fraud log
    db.prepare(`
      UPDATE fraud_logs
      SET
        ground_truth = ?,
        verified_at = CURRENT_TIMESTAMP,
        verified_by = ?,
        is_true_positive = ?,
        is_false_positive = ?,
        is_true_negative = ?,
        is_false_negative = ?
      WHERE id = ?
    `).run(groundTruth, verifiedBy, isTP, isFP, isTN, isFN, logId);

    console.log(`✅ Ground truth verified for log ${logId}: ${groundTruth} (TP:${isTP} FP:${isFP} TN:${isTN} FN:${isFN})`);

    return db.prepare('SELECT * FROM fraud_logs WHERE id = ?').get(logId);
  } catch (error) {
    console.error('Verify ground truth error:', error);
    throw error;
  }
};

/**
 * Get unverified fraud logs for manual review
 * @param {number} limit - Number of records to return
 * @returns {Array} Unverified fraud logs
 */
const getUnverifiedLogs = (limit = 50) => {
  try {
    return db.prepare(`
      SELECT
        fl.*,
        u.full_name as sender_name,
        u.account_id as sender_account_id,
        u.email as sender_email,
        recipient.full_name as recipient_name,
        recipient.account_id as recipient_account_id,
        recipient.email as recipient_email
      FROM fraud_logs fl
      JOIN users u ON fl.user_id = u.id
      LEFT JOIN users recipient ON fl.recipient_id = recipient.id
      WHERE fl.ground_truth IS NULL
      ORDER BY fl.created_at DESC
      LIMIT ?
    `).all(limit);
  } catch (error) {
    console.error('Get unverified logs error:', error);
    return [];
  }
};

/**
 * Get verified fraud logs
 * @param {number} limit - Number of records to return
 * @returns {Array} Verified fraud logs
 */
const getVerifiedLogs = (limit = 100) => {
  try {
    return db.prepare(`
      SELECT
        fl.*,
        u.full_name as sender_name,
        u.account_id as sender_account_id,
        u.email as sender_email,
        recipient.full_name as recipient_name,
        recipient.account_id as recipient_account_id,
        recipient.email as recipient_email
      FROM fraud_logs fl
      JOIN users u ON fl.user_id = u.id
      LEFT JOIN users recipient ON fl.recipient_id = recipient.id
      WHERE fl.ground_truth IS NOT NULL
      ORDER BY fl.verified_at DESC
      LIMIT ?
    `).all(limit);
  } catch (error) {
    console.error('Get verified logs error:', error);
    return [];
  }
};

/**
 * Auto-approve idle fraud detections after 24 hours
 * Only auto-approves REVIEW actions with LOW/MEDIUM/MINIMAL risk
 * @returns {Object} Results of auto-approval operation
 */
const autoApprovePendingReviews = () => {
  try {
    // Find fraud logs eligible for auto-approval:
    // - No ground truth set (still pending)
    // - Created more than 24 hours ago
    // - Action was REVIEW (not BLOCK)
    // - Risk level is NOT HIGH or CRITICAL
    const eligibleLogs = db.prepare(`
      SELECT id, user_id, risk_score, risk_level, action_taken
      FROM fraud_logs
      WHERE ground_truth IS NULL
      AND created_at < datetime('now', '-24 hours')
      AND action_taken = 'REVIEW'
      AND risk_level NOT IN ('HIGH', 'CRITICAL')
    `).all();

    if (eligibleLogs.length === 0) {
      console.log('⏰ Auto-approval: No eligible logs found');
      return { success: true, count: 0, logs: [] };
    }

    // Auto-approve each eligible log
    const stmt = db.prepare(`
      UPDATE fraud_logs
      SET
        ground_truth = 'legitimate',
        auto_approved_at = CURRENT_TIMESTAMP,
        auto_approval_source = 'auto_24hr',
        verified_at = CURRENT_TIMESTAMP,
        is_true_negative = 1
      WHERE id = ?
    `);

    const approvedIds = [];
    for (const log of eligibleLogs) {
      stmt.run(log.id);
      approvedIds.push(log.id);
      console.log(`✅ Auto-approved fraud log ${log.id} (User: ${log.user_id}, Risk: ${log.risk_level})`);
    }

    console.log(`⏰ Auto-approval complete: ${approvedIds.length} logs approved`);

    return {
      success: true,
      count: approvedIds.length,
      logs: approvedIds
    };
  } catch (error) {
    console.error('Auto-approval error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Revoke an auto-approved transaction back to fraud
 * @param {number} logId - Fraud log ID
 * @param {number} revokedBy - Admin user ID
 * @param {string} reason - Reason for revocation
 * @returns {Object} Updated log entry
 */
const revokeAutoApproval = (logId, revokedBy, reason) => {
  try {
    // Get the fraud log
    const log = db.prepare('SELECT * FROM fraud_logs WHERE id = ?').get(logId);

    if (!log) {
      throw new Error('Fraud log not found');
    }

    // Update to fraud status with revocation details
    db.prepare(`
      UPDATE fraud_logs
      SET
        ground_truth = 'fraud',
        revoked_at = CURRENT_TIMESTAMP,
        revoked_by = ?,
        revoked_reason = ?,
        verified_at = CURRENT_TIMESTAMP,
        verified_by = ?,
        is_true_negative = 0,
        is_true_positive = 1
      WHERE id = ?
    `).run(revokedBy, reason, revokedBy, logId);

    console.log(`🚫 Revoked auto-approval for log ${logId} by admin ${revokedBy}`);

    return db.prepare('SELECT * FROM fraud_logs WHERE id = ?').get(logId);
  } catch (error) {
    console.error('Revoke auto-approval error:', error);
    throw error;
  }
};

/**
 * Submit a fraud detection appeal
 * @param {number} fraudLogId - Fraud log ID
 * @param {number} userId - User ID submitting appeal
 * @param {string} reason - Reason for appeal
 * @returns {Object} Created appeal
 */
const submitAppeal = (fraudLogId, userId, reason) => {
  try {
    // Check if fraud log exists
    const log = db.prepare('SELECT * FROM fraud_logs WHERE id = ?').get(fraudLogId);

    if (!log) {
      throw new Error('Fraud log not found');
    }

    // Verify user owns this fraud log
    if (log.user_id !== userId) {
      throw new Error('You can only appeal your own fraud detections');
    }

    // NEW: Check if admin has reviewed first
    if (!log.admin_review_status || log.admin_review_status === 'pending') {
      throw new Error('You cannot appeal until an admin reviews this transaction. Please wait for admin review.');
    }

    // Only allow appeals if admin marked as fraud
    if (log.admin_review_status !== 'fraud') {
      throw new Error('This transaction was already cleared by admin and cannot be appealed.');
    }

    // Check if already appealed
    const existingAppeal = db.prepare('SELECT * FROM fraud_appeals WHERE fraud_log_id = ?').get(fraudLogId);
    if (existingAppeal) {
      throw new Error('You have already submitted an appeal for this transaction');
    }

    // Create appeal
    const result = db.prepare(`
      INSERT INTO fraud_appeals (fraud_log_id, user_id, reason, status)
      VALUES (?, ?, ?, 'pending')
    `).run(fraudLogId, userId, reason);

    // Update fraud log appeal status
    db.prepare(`
      UPDATE fraud_logs
      SET
        appeal_status = 'pending',
        appealed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fraudLogId);

    console.log(`📝 Appeal submitted for fraud log ${fraudLogId} by user ${userId}`);

    return db.prepare('SELECT * FROM fraud_appeals WHERE id = ?').get(result.lastInsertRowid);
  } catch (error) {
    console.error('Submit appeal error:', error);
    throw error;
  }
};

/**
 * Get pending appeals for admin review
 * @param {number} limit - Number of appeals to return
 * @returns {Array} Pending appeals
 */
const getPendingAppeals = (limit = 50) => {
  try {
    return db.prepare(`
      SELECT
        fa.*,
        u.full_name as user_name,
        u.account_id as user_account_id,
        u.email as user_email,
        fl.risk_score,
        fl.risk_level,
        fl.action_taken,
        fl.amount,
        fl.transaction_type,
        fl.ground_truth,
        fl.created_at as fraud_detected_at
      FROM fraud_appeals fa
      JOIN users u ON fa.user_id = u.id
      JOIN fraud_logs fl ON fa.fraud_log_id = fl.id
      WHERE fa.status = 'pending'
      ORDER BY fa.created_at DESC
      LIMIT ?
    `).all(limit);
  } catch (error) {
    console.error('Get pending appeals error:', error);
    return [];
  }
};

/**
 * Get all appeals for a specific user
 * @param {number} userId - User ID
 * @param {number} limit - Number of appeals to return
 * @returns {Array} User's appeals
 */
const getUserAppeals = (userId, limit = 20) => {
  try {
    return db.prepare(`
      SELECT
        fa.*,
        fl.risk_score,
        fl.risk_level,
        fl.action_taken,
        fl.amount,
        fl.transaction_type,
        fl.ground_truth,
        fl.created_at as fraud_detected_at,
        admin.full_name as resolved_by_name
      FROM fraud_appeals fa
      JOIN fraud_logs fl ON fa.fraud_log_id = fl.id
      LEFT JOIN users admin ON fa.resolved_by = admin.id
      WHERE fa.user_id = ?
      ORDER BY fa.created_at DESC
      LIMIT ?
    `).all(userId, limit);
  } catch (error) {
    console.error('Get user appeals error:', error);
    return [];
  }
};

/**
 * Resolve an appeal (approve or reject)
 * @param {number} appealId - Appeal ID
 * @param {number} resolvedBy - Admin user ID
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} adminNotes - Admin notes
 * @returns {Object} Updated appeal
 */
const resolveAppeal = (appealId, resolvedBy, status, adminNotes) => {
  try {
    if (!['approved', 'rejected'].includes(status)) {
      throw new Error('Status must be "approved" or "rejected"');
    }

    // Get appeal
    const appeal = db.prepare('SELECT * FROM fraud_appeals WHERE id = ?').get(appealId);

    if (!appeal) {
      throw new Error('Appeal not found');
    }

    // Update appeal
    db.prepare(`
      UPDATE fraud_appeals
      SET
        status = ?,
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = ?,
        admin_notes = ?
      WHERE id = ?
    `).run(status, resolvedBy, adminNotes, appealId);

    // Update fraud log appeal status
    db.prepare(`
      UPDATE fraud_logs
      SET appeal_status = ?
      WHERE id = ?
    `).run(status, appeal.fraud_log_id);

    // If approved, update fraud log to legitimate
    if (status === 'approved') {
      db.prepare(`
        UPDATE fraud_logs
        SET
          ground_truth = 'legitimate',
          verified_at = CURRENT_TIMESTAMP,
          verified_by = ?
        WHERE id = ?
      `).run(resolvedBy, appeal.fraud_log_id);

      console.log(`✅ Appeal ${appealId} approved - fraud log ${appeal.fraud_log_id} marked legitimate`);
    } else {
      console.log(`❌ Appeal ${appealId} rejected`);
    }

    return db.prepare('SELECT * FROM fraud_appeals WHERE id = ?').get(appealId);
  } catch (error) {
    console.error('Resolve appeal error:', error);
    throw error;
  }
};

/**
 * Get user's fraud flags (for user dashboard)
 * @param {number} userId - User ID
 * @param {number} limit - Number of flags to return
 * @returns {Array} User's fraud flags
 */
const getUserFraudFlags = (userId, limit = 20) => {
  try {
    return db.prepare(`
      SELECT
        fl.*,
        CASE
          WHEN fl.ground_truth IS NULL AND fl.action_taken = 'REVIEW' THEN 'pending_review'
          WHEN fl.ground_truth IS NULL AND fl.action_taken = 'BLOCK' THEN 'blocked'
          WHEN fl.ground_truth = 'legitimate' AND fl.auto_approval_source = 'auto_24hr' THEN 'auto_approved'
          WHEN fl.ground_truth = 'legitimate' THEN 'approved'
          WHEN fl.ground_truth = 'fraud' THEN 'confirmed_fraud'
          ELSE 'unknown'
        END as status_label
      FROM fraud_logs fl
      WHERE fl.user_id = ?
      AND (fl.action_taken IN ('REVIEW', 'BLOCK') OR fl.ground_truth IS NOT NULL)
      ORDER BY fl.created_at DESC
      LIMIT ?
    `).all(userId, limit);
  } catch (error) {
    console.error('Get user fraud flags error:', error);
    return [];
  }
};

// Initialize tables on module load
createFraudLogsTable();
createFraudAppealsTable();

module.exports = {
  logFraudCheck,
  getUserStats,
  getSystemMetrics,
  getRecentHighRiskTransactions,
  verifyGroundTruth,
  getUnverifiedLogs,
  getVerifiedLogs,
  // Auto-approval functions
  autoApprovePendingReviews,
  revokeAutoApproval,
  // Appeals functions
  submitAppeal,
  getPendingAppeals,
  getUserAppeals,
  resolveAppeal,
  getUserFraudFlags
};
