/**
 * Fraud Detection Engine
 * Analyzes transactions for fraud risk
 */

const database = require('../../../shared/database/postgres');

/**
 * Analyze transaction for fraud risk
 */
async function analyzeFraudRisk(transaction) {
  const startTime = Date.now();
  const triggeredRules = [];
  let flags = {};

  try {
    // Rule 1: High amount check
    if (transaction.amount > 1000) {
      triggeredRules.push({
        name: 'high_amount',
        severity: transaction.amount > 5000 ? 'high' : 'medium',
        score: transaction.amount > 5000 ? 30 : 15
      });
      flags.highAmount = true;
    }

    // Rule 2: Velocity check (transactions in last hour)
    const recentTxns = await database.query(
      `SELECT COUNT(*) as count FROM transactions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [transaction.userId]
    );

    const txnCount = parseInt(recentTxns.rows[0].count);
    if (txnCount > 5) {
      triggeredRules.push({
        name: 'high_velocity',
        severity: 'high',
        score: 25
      });
      flags.highVelocity = true;
    } else if (txnCount > 3) {
      triggeredRules.push({
        name: 'moderate_velocity',
        severity: 'medium',
        score: 10
      });
      flags.moderateVelocity = true;
    }

    // Rule 3: Unusual amount (compared to user average)
    const avgAmount = await database.query(
      `SELECT AVG(amount) as avg FROM transactions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [transaction.userId]
    );

    const userAvg = parseFloat(avgAmount.rows[0].avg) || 100;
    if (transaction.amount > userAvg * 3) {
      triggeredRules.push({
        name: 'unusual_amount',
        severity: 'medium',
        score: 20
      });
      flags.unusualAmount = true;
    }

    // Rule 4: New user check
    const userAge = await database.query(
      `SELECT EXTRACT(DAY FROM NOW() - created_at) as days FROM users WHERE id = $1`,
      [transaction.userId]
    );

    const accountAge = parseInt(userAge.rows[0]?.days) || 0;
    if (accountAge < 7 && transaction.amount > 500) {
      triggeredRules.push({
        name: 'new_user_high_amount',
        severity: 'medium',
        score: 15
      });
      flags.newUser = true;
    }

    // Calculate total risk score
    const riskScore = Math.min(100, triggeredRules.reduce((sum, rule) => sum + rule.score, 0));

    // Determine risk level
    let riskLevel;
    if (riskScore >= 80) riskLevel = 'critical';
    else if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 40) riskLevel = 'medium';
    else riskLevel = 'low';

    // Determine action
    let action;
    if (riskScore >= 80) action = 'BLOCK';
    else if (riskScore >= 60) action = 'REVIEW';
    else if (riskScore >= 40) action = 'CHALLENGE';
    else action = 'ALLOW';

    return {
      riskScore,
      riskLevel,
      action,
      triggeredRules,
      flags,
      executionTime: Date.now() - startTime
    };

  } catch (error) {
    console.error('Fraud analysis error:', error);
    return {
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      action: 'ALLOW',
      triggeredRules: [],
      flags: {},
      error: error.message,
      executionTime: Date.now() - startTime
    };
  }
}

module.exports = {
  analyzeFraudRisk
};
