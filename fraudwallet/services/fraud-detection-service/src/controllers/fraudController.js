const database = require('../../../shared/database/postgres');
const ResponseHandler = require('../../../shared/utils/responseHandler');
const Logger = require('../../../shared/utils/logger');
const fraudEngine = require('../engine/fraudEngine');

const logger = new Logger('fraud-controller');

/**
 * Check transaction for fraud
 */
exports.checkTransaction = async (req, res) => {
  try {
    const { userId, type, amount, recipientId } = req.body;

    if (!userId || !type || !amount) {
      return ResponseHandler.error(res, 'Missing required fields', 400);
    }

    // Perform fraud analysis
    const result = await fraudEngine.analyzeFraudRisk({
      userId,
      type,
      amount,
      recipientId
    });

    // Store fraud log
    await database.query(
      `INSERT INTO fraud_logs (user_id, risk_score, risk_level, flags, rules_triggered, action_taken, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        result.riskScore,
        result.riskLevel,
        JSON.stringify(result.flags || {}),
        result.triggeredRules.map(r => r.name),
        result.action,
        JSON.stringify({ type, amount, recipientId })
      ]
    );

    // Update user risk profile
    await updateUserRiskProfile(userId, result.riskScore);

    logger.info('Fraud check completed', { userId, riskScore: result.riskScore, action: result.action });

    return res.json({
      success: true,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      action: result.action,
      flags: result.flags,
      triggeredRules: result.triggeredRules
    });

  } catch (error) {
    logger.error('Check transaction error', error);
    // Return safe defaults on error
    return res.json({
      success: true,
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      action: 'ALLOW',
      error: 'Fraud detection service error'
    });
  }
};

/**
 * Get user fraud statistics
 */
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await database.query(
      `SELECT
        COALESCE(overall_risk_score, 0) as overall_risk_score,
        total_transactions,
        flagged_transactions,
        blocked_transactions,
        total_amount_transacted,
        avg_transaction_amount,
        last_risk_update
       FROM user_risk_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return ResponseHandler.success(res, {
        overallRiskScore: 0,
        totalTransactions: 0,
        flaggedTransactions: 0,
        blockedTransactions: 0
      });
    }

    return ResponseHandler.success(res, result.rows[0]);

  } catch (error) {
    logger.error('Get user stats error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Get system-wide metrics
 */
exports.getSystemMetrics = async (req, res) => {
  try {
    const metrics = await database.query(
      `SELECT
        COUNT(*) as total_fraud_checks,
        COUNT(CASE WHEN risk_level = 'high' OR risk_level = 'critical' THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN action_taken = 'blocked' THEN 1 END) as blocked_count,
        AVG(risk_score) as avg_risk_score
       FROM fraud_logs
       WHERE created_at > NOW() - INTERVAL '30 days'`
    );

    return ResponseHandler.success(res, metrics.rows[0]);

  } catch (error) {
    logger.error('Get system metrics error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Get recent fraud logs
 */
exports.getRecentLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const result = await database.query(
      `SELECT
        fl.id,
        fl.user_id,
        u.full_name,
        u.email,
        fl.risk_score,
        fl.risk_level,
        fl.action_taken,
        fl.created_at
       FROM fraud_logs fl
       JOIN users u ON fl.user_id = u.id
       ORDER BY fl.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return ResponseHandler.success(res, { logs: result.rows });

  } catch (error) {
    logger.error('Get recent logs error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Get high-risk users
 */
exports.getHighRiskUsers = async (req, res) => {
  try {
    const result = await database.query(
      `SELECT
        u.id,
        u.account_id,
        u.full_name,
        u.email,
        urp.overall_risk_score,
        urp.flagged_transactions,
        urp.blocked_transactions
       FROM users u
       JOIN user_risk_profiles urp ON u.id = urp.user_id
       WHERE urp.overall_risk_score > 60
       ORDER BY urp.overall_risk_score DESC
       LIMIT 20`
    );

    return ResponseHandler.success(res, { users: result.rows });

  } catch (error) {
    logger.error('Get high-risk users error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Get detailed fraud info for a user
 */
exports.getUserFraudDetails = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const logs = await database.query(
      `SELECT * FROM fraud_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    const profile = await database.query(
      `SELECT * FROM user_risk_profiles WHERE user_id = $1`,
      [userId]
    );

    return ResponseHandler.success(res, {
      logs: logs.rows,
      profile: profile.rows[0] || null
    });

  } catch (error) {
    logger.error('Get user fraud details error', error);
    return ResponseHandler.serverError(res, error);
  }
};

/**
 * Helper: Update user risk profile
 */
async function updateUserRiskProfile(userId, newRiskScore) {
  try {
    await database.query(
      `INSERT INTO user_risk_profiles (user_id, overall_risk_score, total_transactions, last_risk_update)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         overall_risk_score = (user_risk_profiles.overall_risk_score * 0.8) + ($2 * 0.2),
         total_transactions = user_risk_profiles.total_transactions + 1,
         flagged_transactions = user_risk_profiles.flagged_transactions + CASE WHEN $2 > 60 THEN 1 ELSE 0 END,
         blocked_transactions = user_risk_profiles.blocked_transactions + CASE WHEN $2 > 80 THEN 1 ELSE 0 END,
         last_risk_update = NOW()`,
      [userId, newRiskScore]
    );
  } catch (error) {
    logger.error('Update risk profile error', error);
  }
}
