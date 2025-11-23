// Velocity-based fraud detection rules
// Detects suspicious transaction patterns based on frequency and timing

const db = require('../../database');

/**
 * Check velocity-based fraud patterns
 * @param {Object} transaction - Current transaction
 * @param {Object} userContext - User context data
 * @returns {Object} Velocity check results
 */
const checkVelocity = async (transaction, userContext) => {
  const rules = [];
  const userId = transaction.userId;
  const currentTime = new Date();

  try {
    // Rule 1: High frequency transactions (>5 in 1 minute)
    const oneMinuteAgo = new Date(currentTime.getTime() - 60 * 1000);
    const txnsLastMinute = db.prepare(`
      SELECT COUNT(*) as count FROM transactions
      WHERE user_id = ? AND created_at > ?
    `).get(userId, oneMinuteAgo.toISOString());

    if (txnsLastMinute.count >= 5) {
      rules.push({
        ruleId: 'VEL-001',
        ruleName: 'High Frequency Transactions',
        description: `${txnsLastMinute.count} transactions in last minute`,
        severity: 'HIGH',
        weight: 25,
        triggered: true,
        metadata: { count: txnsLastMinute.count, timeWindow: '1 minute' }
      });
    }

    // Rule 2: Rapid sequential transactions (<5 seconds apart)
    const lastTransaction = db.prepare(`
      SELECT created_at FROM transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);

    if (lastTransaction) {
      const lastTxnTime = new Date(lastTransaction.created_at);
      const timeDiff = (currentTime - lastTxnTime) / 1000; // seconds

      if (timeDiff < 5) {
        rules.push({
          ruleId: 'VEL-002',
          ruleName: 'Rapid Sequential Transactions',
          description: `Transaction ${timeDiff.toFixed(1)}s after previous`,
          severity: 'MEDIUM',
          weight: 20,
          triggered: true,
          metadata: { secondsSinceLastTxn: timeDiff }
        });
      }
    }

    // Rule 3: High daily transaction count (>20 in 24 hours)
    const oneDayAgo = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
    const txnsLast24Hours = db.prepare(`
      SELECT COUNT(*) as count FROM transactions
      WHERE user_id = ? AND created_at > ?
    `).get(userId, oneDayAgo.toISOString());

    if (txnsLast24Hours.count >= 20) {
      rules.push({
        ruleId: 'VEL-003',
        ruleName: 'Excessive Daily Transactions',
        description: `${txnsLast24Hours.count} transactions in last 24 hours`,
        severity: 'MEDIUM',
        weight: 15,
        triggered: true,
        metadata: { count: txnsLast24Hours.count, timeWindow: '24 hours' }
      });
    }

    // Rule 4: Velocity spike (current hour vs average)
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);
    const txnsLastHour = db.prepare(`
      SELECT COUNT(*) as count FROM transactions
      WHERE user_id = ? AND created_at > ?
    `).get(userId, oneHourAgo.toISOString());

    // Get user's average hourly transaction count
    const avgHourlyTxns = db.prepare(`
      SELECT COUNT(*) / 24.0 as avg FROM transactions
      WHERE user_id = ? AND created_at > ?
    `).get(userId, oneDayAgo.toISOString());

    if (avgHourlyTxns.avg > 0 && txnsLastHour.count > avgHourlyTxns.avg * 5) {
      rules.push({
        ruleId: 'VEL-004',
        ruleName: 'Transaction Velocity Spike',
        description: `Current hour: ${txnsLastHour.count} txns vs avg ${avgHourlyTxns.avg.toFixed(1)}`,
        severity: 'HIGH',
        weight: 20,
        triggered: true,
        metadata: {
          currentHour: txnsLastHour.count,
          average: avgHourlyTxns.avg.toFixed(2),
          multiplier: (txnsLastHour.count / avgHourlyTxns.avg).toFixed(1)
        }
      });
    }

    // Rule 5: Multiple failed transactions before success
    const recentFailedTxns = db.prepare(`
      SELECT COUNT(*) as count FROM transactions
      WHERE user_id = ?
      AND created_at > ?
      AND status = 'failed'
    `).get(userId, oneHourAgo.toISOString());

    if (recentFailedTxns.count >= 3) {
      rules.push({
        ruleId: 'VEL-005',
        ruleName: 'Multiple Failed Transaction Attempts',
        description: `${recentFailedTxns.count} failed transactions in last hour`,
        severity: 'MEDIUM',
        weight: 15,
        triggered: true,
        metadata: { failedCount: recentFailedTxns.count }
      });
    }

  } catch (error) {
    console.error('Velocity check error:', error);
  }

  return { rules };
};

module.exports = {
  checkVelocity
};
