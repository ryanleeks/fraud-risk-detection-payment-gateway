// Fraud Detection API Endpoints
// Provides access to fraud detection metrics and statistics

const fraudDetection = require('./fraud-detection');
const fraudLogger = require('./fraud-detection/monitoring/fraudLogger');
const academicMetrics = require('./fraud-detection/monitoring/academicMetrics');
const db = require('./database');

/**
 * Get dashboard metrics for current user
 * Returns: scannedTotal, blocked, highRisk, appeals
 */
const getUserDashboardMetrics = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get scanned total (all fraud logs for user)
    const scannedTotal = db.prepare(`
      SELECT COUNT(*) as count
      FROM fraud_logs
      WHERE user_id = ?
    `).get(userId);

    // Get blocked transactions
    const blocked = db.prepare(`
      SELECT COUNT(*) as count
      FROM fraud_logs
      WHERE user_id = ? AND action_taken = 'BLOCK'
    `).get(userId);

    // Get high risk transactions (high + critical)
    const highRisk = db.prepare(`
      SELECT COUNT(*) as count
      FROM fraud_logs
      WHERE user_id = ? AND risk_level IN ('high', 'critical')
    `).get(userId);

    // Get pending appeals
    const appeals = db.prepare(`
      SELECT COUNT(*) as count
      FROM fraud_appeals
      WHERE user_id = ? AND status = 'pending'
    `).get(userId);

    res.status(200).json({
      success: true,
      metrics: {
        scannedTotal: scannedTotal.count || 0,
        blocked: blocked.count || 0,
        highRisk: highRisk.count || 0,
        appeals: appeals.count || 0
      }
    });
  } catch (error) {
    console.error('Get dashboard metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard metrics'
    });
  }
};

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
    const rawMetrics = await fraudDetection.getSystemMetrics();

    // Get action distribution
    const actionDist = db.prepare(`
      SELECT
        action_taken,
        COUNT(*) as count
      FROM fraud_logs
      WHERE created_at > datetime('now', '-24 hours')
      GROUP BY action_taken
    `).all();

    const actionDistribution = {
      allow: 0,
      challenge: 0,
      review: 0,
      block: 0
    };

    actionDist.forEach(item => {
      const action = item.action_taken.toLowerCase();
      if (action in actionDistribution) {
        actionDistribution[action] = item.count;
      }
    });

    // Extract and count individual rules from triggered rules
    const ruleStats = db.prepare(`
      SELECT rules_triggered
      FROM fraud_logs
      WHERE created_at > datetime('now', '-7 days')
      AND rules_triggered != '[]'
    `).all();

    const ruleCounts = {};
    ruleStats.forEach(row => {
      try {
        const rules = JSON.parse(row.rules_triggered);
        rules.forEach(ruleId => {
          ruleCounts[ruleId] = (ruleCounts[ruleId] || 0) + 1;
        });
      } catch (e) {}
    });

    // Convert to array and sort
    const topRules = Object.entries(ruleCounts)
      .map(([ruleId, count]) => ({ ruleId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Transform to frontend-expected format
    const metrics = {
      totalChecks: rawMetrics.last24Hours?.total_checks || 0,
      avgResponseTime: rawMetrics.last24Hours?.avg_execution_time || 0,
      actionDistribution,
      topRules,
      riskDistribution: {
        minimal: 0,
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      }
    };

    // Map risk levels
    if (rawMetrics.riskLevelDistribution) {
      rawMetrics.riskLevelDistribution.forEach(item => {
        const level = item.risk_level.toLowerCase();
        if (level in metrics.riskDistribution) {
          metrics.riskDistribution[level] = item.count;
        }
      });
    }

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
    // Check if AI is enabled
    const geminiAI = require('./fraud-detection/geminiAI');
    const aiEnabled = geminiAI.enabled || false;

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
      AND ai_risk_score IS NOT NULL
    `).get();

    // Get top AI red flags
    const redFlagsData = db.prepare(`
      SELECT ai_red_flags
      FROM fraud_logs
      WHERE created_at > datetime('now', '-7 days')
      AND ai_red_flags IS NOT NULL
      AND ai_red_flags != '[]'
    `).all();

    const redFlagCounts = {};
    redFlagsData.forEach(row => {
      try {
        const flags = JSON.parse(row.ai_red_flags);
        flags.forEach(flag => {
          redFlagCounts[flag] = (redFlagCounts[flag] || 0) + 1;
        });
      } catch (e) {}
    });

    const topRedFlags = Object.entries(redFlagCounts)
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate disagreement rate
    const disagreements = db.prepare(`
      SELECT
        COUNT(*) as total_hybrid,
        COUNT(CASE WHEN ABS(rule_based_score - ai_risk_score) >= 20 THEN 1 END) as significant_disagreements
      FROM fraud_logs
      WHERE created_at > datetime('now', '-7 days')
      AND detection_method = 'hybrid'
      AND ai_risk_score IS NOT NULL
      AND rule_based_score IS NOT NULL
    `).get();

    const disagreementRate = disagreements.total_hybrid > 0
      ? disagreements.significant_disagreements / disagreements.total_hybrid
      : 0;

    // Transform to frontend-expected format
    const metrics = {
      aiEnabled,
      totalAnalyses: aiUsage.total_ai_checks || 0,
      avgConfidence: aiUsage.avg_confidence || 0,
      avgRiskScore: aiUsage.avg_ai_score || 0,
      avgResponseTime: aiUsage.avg_response_time || 0,
      topRedFlags,
      disagreementRate
    };

    res.status(200).json({
      success: true,
      metrics
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

/**
 * Verify ground truth for a fraud log (admin only)
 */
const verifyGroundTruth = async (req, res) => {
  try {
    const { logId } = req.params;
    const { groundTruth } = req.body;

    // Validate input
    if (!groundTruth || !['fraud', 'legitimate'].includes(groundTruth)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ground truth value. Must be "fraud" or "legitimate"'
      });
    }

    // Verify as admin (user ID from auth)
    const verifiedBy = req.user.userId;

    const updatedLog = await fraudLogger.verifyGroundTruth(
      parseInt(logId),
      groundTruth,
      verifiedBy
    );

    res.status(200).json({
      success: true,
      message: 'Ground truth verified successfully',
      log: updatedLog
    });
  } catch (error) {
    console.error('Verify ground truth error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error verifying ground truth'
    });
  }
};

/**
 * Get unverified fraud logs for review
 */
const getUnverifiedLogs = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const logs = fraudLogger.getUnverifiedLogs(parseInt(limit));

    res.status(200).json({
      success: true,
      count: logs.length,
      logs: logs.map(log => ({
        ...log,
        ai_red_flags: log.ai_red_flags ? JSON.parse(log.ai_red_flags) : []
      }))
    });
  } catch (error) {
    console.error('Get unverified logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unverified logs'
    });
  }
};

/**
 * Get verified fraud logs
 */
const getVerifiedLogs = async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const logs = fraudLogger.getVerifiedLogs(parseInt(limit));

    res.status(200).json({
      success: true,
      count: logs.length,
      logs: logs.map(log => ({
        ...log,
        ai_red_flags: log.ai_red_flags ? JSON.parse(log.ai_red_flags) : []
      }))
    });
  } catch (error) {
    console.error('Get verified logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching verified logs'
    });
  }
};

/**
 * Get comprehensive academic metrics
 */
const getAcademicMetrics = async (req, res) => {
  try {
    const metrics = academicMetrics.getAcademicMetrics();

    res.status(200).json({
      success: true,
      metrics: metrics
    });
  } catch (error) {
    console.error('Get academic metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching academic metrics'
    });
  }
};

/**
 * Get confusion matrix
 */
const getConfusionMatrix = async (req, res) => {
  try {
    const matrix = academicMetrics.getConfusionMatrix();

    res.status(200).json({
      success: true,
      confusionMatrix: matrix
    });
  } catch (error) {
    console.error('Get confusion matrix error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching confusion matrix'
    });
  }
};

/**
 * Get metrics history over time
 */
const getMetricsHistory = async (req, res) => {
  try {
    const { days = 30, interval = 'day' } = req.query;

    const history = academicMetrics.getMetricsHistory(
      parseInt(days),
      interval
    );

    res.status(200).json({
      success: true,
      count: history.length,
      history: history
    });
  } catch (error) {
    console.error('Get metrics history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching metrics history'
    });
  }
};

/**
 * Get error analysis (false positives and false negatives)
 */
const getErrorAnalysis = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const analysis = academicMetrics.getErrorAnalysis(parseInt(limit));

    res.status(200).json({
      success: true,
      analysis: analysis
    });
  } catch (error) {
    console.error('Get error analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching error analysis'
    });
  }
};

/**
 * Get threshold analysis for ROC curve
 */
const getThresholdAnalysis = async (req, res) => {
  try {
    const analysis = academicMetrics.getThresholdAnalysis();

    res.status(200).json({
      success: true,
      analysis: analysis
    });
  } catch (error) {
    console.error('Get threshold analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching threshold analysis'
    });
  }
};

/**
 * Export dataset for academic analysis
 */
const exportDataset = async (req, res) => {
  try {
    const csv = academicMetrics.exportDataset();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="fraud_detection_dataset.csv"');
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export dataset error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting dataset'
    });
  }
};

/**
 * Get system health metrics (CPU, memory, latency, connection status)
 */
const getSystemHealth = async (req, res) => {
  try {
    const os = require('os');
    const startTime = Date.now();

    // CPU Usage
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total) * 100;
    }, 0) / cpus.length;

    // Memory Usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    // Process Memory
    const processMemory = process.memoryUsage();

    // Database Latency - test query
    const dbStartTime = Date.now();
    db.prepare('SELECT 1').get();
    const dbLatency = Date.now() - dbStartTime;

    // Test AI Connection (Gemini)
    let aiConnectionStatus = 'unknown';
    let aiConnectionLatency = 0;
    try {
      const geminiAI = require('./fraud-detection/geminiAI');
      if (geminiAI.enabled) {
        aiConnectionStatus = 'connected';
        // We can't easily test the actual connection without making a real API call
        // so we just check if it's configured
      } else {
        aiConnectionStatus = 'disabled';
      }
    } catch (error) {
      aiConnectionStatus = 'error';
    }

    // API Response Time (this endpoint itself)
    const apiLatency = Date.now() - startTime;

    const health = {
      cpu: {
        usage: parseFloat(cpuUsage.toFixed(2)),
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown'
      },
      memory: {
        totalMB: Math.round(totalMemory / 1024 / 1024),
        usedMB: Math.round(usedMemory / 1024 / 1024),
        freeMB: Math.round(freeMemory / 1024 / 1024),
        usagePercent: parseFloat(memoryUsagePercent.toFixed(2)),
        process: {
          heapUsedMB: Math.round(processMemory.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(processMemory.heapTotal / 1024 / 1024),
          rssMB: Math.round(processMemory.rss / 1024 / 1024)
        }
      },
      latency: {
        api: apiLatency,
        database: dbLatency
      },
      connections: {
        ai: {
          status: aiConnectionStatus,
          latency: aiConnectionLatency
        },
        database: {
          status: 'connected' // If we got here, DB is connected
        }
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      health
    });
  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system health'
    });
  }
};

/**
 * Revoke auto-approved transaction (admin only)
 */
const revokeAutoApproval = async (req, res) => {
  try {
    const { logId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for revoking auto-approval'
      });
    }

    const adminId = req.user.userId;

    const updatedLog = fraudLogger.revokeAutoApproval(
      parseInt(logId),
      adminId,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Auto-approval revoked successfully',
      log: updatedLog
    });
  } catch (error) {
    console.error('Revoke auto-approval error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error revoking auto-approval'
    });
  }
};

/**
 * Submit fraud detection appeal (user endpoint)
 */
const submitAppeal = async (req, res) => {
  try {
    const { logId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for submitting an appeal'
      });
    }

    const userId = req.user.userId;

    const appeal = fraudLogger.submitAppeal(
      parseInt(logId),
      userId,
      reason
    );

    res.status(201).json({
      success: true,
      message: 'Appeal submitted successfully',
      appeal: appeal
    });
  } catch (error) {
    console.error('Submit appeal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error submitting appeal'
    });
  }
};

/**
 * Get pending appeals for admin review
 */
const getPendingAppeals = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const appeals = fraudLogger.getPendingAppeals(parseInt(limit));

    res.status(200).json({
      success: true,
      count: appeals.length,
      appeals: appeals
    });
  } catch (error) {
    console.error('Get pending appeals error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending appeals'
    });
  }
};

/**
 * Get user's own appeals
 */
const getUserAppeals = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;

    const appeals = fraudLogger.getUserAppeals(userId, parseInt(limit));

    res.status(200).json({
      success: true,
      count: appeals.length,
      appeals: appeals
    });
  } catch (error) {
    console.error('Get user appeals error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appeals'
    });
  }
};

/**
 * Resolve an appeal (admin only)
 */
const resolveAppeal = async (req, res) => {
  try {
    const { appealId } = req.params;
    const { status, adminNotes } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "approved" or "rejected"'
      });
    }

    const adminId = req.user.userId;

    const updatedAppeal = fraudLogger.resolveAppeal(
      parseInt(appealId),
      adminId,
      status,
      adminNotes || ''
    );

    res.status(200).json({
      success: true,
      message: `Appeal ${status} successfully`,
      appeal: updatedAppeal
    });
  } catch (error) {
    console.error('Resolve appeal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error resolving appeal'
    });
  }
};

/**
 * Get user's fraud flags (for user dashboard)
 */
const getUserFraudFlags = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;

    const flags = fraudLogger.getUserFraudFlags(userId, parseInt(limit));

    res.status(200).json({
      success: true,
      count: flags.length,
      flags: flags
    });
  } catch (error) {
    console.error('Get user fraud flags error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fraud flags'
    });
  }
};

/**
 * Trigger manual auto-approval job (admin only)
 */
const triggerAutoApproval = async (req, res) => {
  try {
    const result = fraudLogger.autoApprovePendingReviews();

    res.status(200).json({
      success: true,
      message: 'Auto-approval job completed',
      result: result
    });
  } catch (error) {
    console.error('Trigger auto-approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering auto-approval'
    });
  }
};

module.exports = {
  getUserDashboardMetrics,
  getUserFraudStats,
  getSystemMetrics,
  getRecentFraudLogs,
  getHighRiskUsers,
  getTopFlaggedUsers,
  getUserFraudDetails,
  // AI endpoints
  getAIFraudLogs,
  getAIMetrics,
  getDisagreementCases,
  // Academic metrics endpoints
  verifyGroundTruth,
  getUnverifiedLogs,
  getVerifiedLogs,
  getAcademicMetrics,
  getConfusionMatrix,
  getMetricsHistory,
  getErrorAnalysis,
  getThresholdAnalysis,
  exportDataset,
  // System health
  getSystemHealth,
  // Auto-approval endpoints
  revokeAutoApproval,
  triggerAutoApproval,
  // Appeals endpoints
  submitAppeal,
  getPendingAppeals,
  getUserAppeals,
  resolveAppeal,
  getUserFraudFlags
};
