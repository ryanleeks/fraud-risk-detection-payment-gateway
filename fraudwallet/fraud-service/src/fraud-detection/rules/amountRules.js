// Amount-based fraud detection rules
// Detects suspicious transaction amounts and patterns

const db = require('../../database');

/**
 * Check amount-based fraud patterns
 * @param {Object} transaction - Current transaction
 * @param {Object} userContext - User context data
 * @returns {Object} Amount check results
 */
const checkAmount = (transaction, userContext) => {
  const rules = [];
  const amount = transaction.amount;
  const userId = transaction.userId;

  try {
    // Rule 1: Large single transaction (>RM50,000)
    if (amount > 50000) {
      rules.push({
        ruleId: 'AMT-001',
        ruleName: 'Large Single Transaction',
        description: `Transaction amount RM${amount.toFixed(2)} exceeds threshold`,
        severity: 'HIGH',
        weight: 30,
        triggered: true,
        metadata: { amount: amount, threshold: 50000 }
      });
    }

    // Rule 2: Just-below-reporting threshold (structuring detection)
    // Common fraud: transactions just under RM10,000 to avoid reporting
    if (amount >= 9500 && amount < 10000) {
      rules.push({
        ruleId: 'AMT-002',
        ruleName: 'Structuring Pattern (Just Below Threshold)',
        description: `Transaction RM${amount.toFixed(2)} just below RM10,000 reporting threshold`,
        severity: 'HIGH',
        weight: 25,
        triggered: true,
        metadata: { amount: amount, threshold: 10000, difference: 10000 - amount }
      });
    }

    // Rule 3: Unusual round numbers (money laundering pattern)
    // Exactly RM10,000, RM5,000, RM50,000, etc.
    const roundNumbers = [1000, 5000, 10000, 20000, 50000, 100000];
    if (roundNumbers.includes(amount)) {
      rules.push({
        ruleId: 'AMT-003',
        ruleName: 'Exact Round Number Transaction',
        description: `Transaction is exactly RM${amount.toFixed(2)}`,
        severity: 'MEDIUM',
        weight: 10,
        triggered: true,
        metadata: { amount: amount }
      });
    }

    // Rule 4: Micro-transaction testing (card testing fraud)
    if (amount < 1 && transaction.type === 'deposit') {
      rules.push({
        ruleId: 'AMT-004',
        ruleName: 'Micro-Transaction Testing',
        description: `Very small deposit RM${amount.toFixed(2)} (card testing)`,
        severity: 'MEDIUM',
        weight: 15,
        triggered: true,
        metadata: { amount: amount }
      });
    }

    // Rule 5: Amount matches previous transactions (repetitive pattern)
    const recentSameAmountTxns = db.prepare(`
      SELECT COUNT(*) as count FROM transactions
      WHERE user_id = ?
      AND amount = ?
      AND created_at > datetime('now', '-24 hours')
    `).get(userId, amount);

    if (recentSameAmountTxns.count >= 3) {
      rules.push({
        ruleId: 'AMT-005',
        ruleName: 'Repetitive Amount Pattern',
        description: `Same amount RM${amount.toFixed(2)} used ${recentSameAmountTxns.count} times in 24h`,
        severity: 'MEDIUM',
        weight: 15,
        triggered: true,
        metadata: { amount: amount, count: recentSameAmountTxns.count }
      });
    }

    // Rule 6: Unusual amount for user (deviation from normal)
    const userStats = db.prepare(`
      SELECT
        AVG(amount) as avg_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE user_id = ?
      AND created_at > datetime('now', '-30 days')
    `).get(userId);

    if (userStats.avg_amount && amount > userStats.avg_amount * 10) {
      rules.push({
        ruleId: 'AMT-006',
        ruleName: 'Amount Deviation from User Pattern',
        description: `RM${amount.toFixed(2)} is ${(amount / userStats.avg_amount).toFixed(1)}x user's average`,
        severity: 'MEDIUM',
        weight: 20,
        triggered: true,
        metadata: {
          currentAmount: amount,
          averageAmount: userStats.avg_amount.toFixed(2),
          multiplier: (amount / userStats.avg_amount).toFixed(1)
        }
      });
    }

    // Rule 7: Daily amount limit exceeded (>RM100,000 total per day)
    const dailyTotal = db.prepare(`
      SELECT SUM(amount) as total FROM transactions
      WHERE user_id = ?
      AND created_at > datetime('now', '-24 hours')
      AND status = 'completed'
    `).get(userId);

    const newDailyTotal = (dailyTotal.total || 0) + amount;
    if (newDailyTotal > 100000) {
      rules.push({
        ruleId: 'AMT-007',
        ruleName: 'Daily Transaction Limit Exceeded',
        description: `Daily total RM${newDailyTotal.toFixed(2)} exceeds RM100,000 limit`,
        severity: 'HIGH',
        weight: 25,
        triggered: true,
        metadata: {
          currentTotal: (dailyTotal.total || 0).toFixed(2),
          newTotal: newDailyTotal.toFixed(2),
          limit: 100000
        }
      });
    }

    // Rule 8: Odd decimal amounts (layering technique)
    // e.g., RM1,234.56 or RM987.65 - unusual precision might indicate layering
    const decimalPart = (amount % 1).toFixed(2);
    if (decimalPart !== '0.00' && amount > 1000) {
      const hasUnusualDecimals = decimalPart !== '0.50' && decimalPart !== '0.25' && decimalPart !== '0.75';
      if (hasUnusualDecimals) {
        rules.push({
          ruleId: 'AMT-008',
          ruleName: 'Unusual Decimal Precision',
          description: `Amount RM${amount.toFixed(2)} has unusual decimal precision`,
          severity: 'LOW',
          weight: 5,
          triggered: true,
          metadata: { amount: amount, decimalPart: decimalPart }
        });
      }
    }

  } catch (error) {
    console.error('Amount check error:', error);
  }

  return { rules };
};

module.exports = {
  checkAmount
};
