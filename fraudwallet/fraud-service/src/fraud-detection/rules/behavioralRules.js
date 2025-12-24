// Behavioral fraud detection rules
// Detects suspicious user behavior and account patterns

const db = require('../../database');

/**
 * Check behavioral fraud patterns
 * @param {Object} transaction - Current transaction
 * @param {Object} userContext - User context data
 * @returns {Object} Behavioral check results
 */
const checkBehavior = async (transaction, userContext) => {
  const rules = [];
  const userId = transaction.userId;
  const currentTime = new Date();

  try {
    // Get user account info
    const user = db.prepare('SELECT created_at, account_status FROM users WHERE id = ?').get(userId);

    if (!user) {
      return { rules };
    }

    // Rule 1: New account activity (account <24 hours old with large transaction)
    const accountAge = (currentTime - new Date(user.created_at)) / (1000 * 60 * 60); // hours
    if (accountAge < 24 && transaction.amount > 1000) {
      rules.push({
        ruleId: 'BEH-001',
        ruleName: 'New Account High-Value Transaction',
        description: `Account ${accountAge.toFixed(1)}h old attempting RM${transaction.amount.toFixed(2)} transaction`,
        severity: 'HIGH',
        weight: 30,
        triggered: true,
        metadata: { accountAgeHours: accountAge.toFixed(1), amount: transaction.amount }
      });
    }

    // Rule 2: First transaction is high value
    const transactionCount = db.prepare(`
      SELECT COUNT(*) as count FROM transactions WHERE user_id = ?
    `).get(userId);

    if (transactionCount.count === 0 && transaction.amount > 5000) {
      rules.push({
        ruleId: 'BEH-002',
        ruleName: 'First Transaction High Value',
        description: `First ever transaction is RM${transaction.amount.toFixed(2)}`,
        severity: 'MEDIUM',
        weight: 20,
        triggered: true,
        metadata: { amount: transaction.amount }
      });
    }

    // Rule 3: Dormant account reactivation
    const lastTransaction = db.prepare(`
      SELECT created_at FROM transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);

    if (lastTransaction) {
      const daysSinceLastTxn = (currentTime - new Date(lastTransaction.created_at)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastTxn > 30) {
        rules.push({
          ruleId: 'BEH-003',
          ruleName: 'Dormant Account Reactivation',
          description: `Account inactive for ${daysSinceLastTxn.toFixed(0)} days`,
          severity: 'MEDIUM',
          weight: 15,
          triggered: true,
          metadata: { daysSinceLastTxn: daysSinceLastTxn.toFixed(0) }
        });
      }
    }

    // Rule 4: Unusual time of day (2 AM - 6 AM)
    const hour = currentTime.getHours();
    if (hour >= 2 && hour < 6) {
      rules.push({
        ruleId: 'BEH-004',
        ruleName: 'Unusual Transaction Time',
        description: `Transaction at ${hour}:${currentTime.getMinutes()} (unusual hours)`,
        severity: 'LOW',
        weight: 10,
        triggered: true,
        metadata: { hour: hour, minute: currentTime.getMinutes() }
      });
    }

    // Rule 5: Circular transfer pattern (A→B→C→A)
    if (transaction.recipientId) {
      const circularPattern = db.prepare(`
        SELECT COUNT(*) as count FROM transactions
        WHERE user_id = ? AND recipient_id = ?
        AND created_at > datetime('now', '-1 hour')
      `).get(transaction.recipientId, userId);

      if (circularPattern.count > 0) {
        rules.push({
          ruleId: 'BEH-005',
          ruleName: 'Circular Transfer Pattern',
          description: 'Detected potential circular money movement',
          severity: 'HIGH',
          weight: 25,
          triggered: true,
          metadata: { patternCount: circularPattern.count }
        });
      }
    }

    // Rule 6: Multiple recipients in short time (money mule behavior)
    const uniqueRecipients = db.prepare(`
      SELECT COUNT(DISTINCT recipient_id) as count FROM transactions
      WHERE user_id = ?
      AND recipient_id IS NOT NULL
      AND created_at > datetime('now', '-1 hour')
    `).get(userId);

    if (uniqueRecipients.count >= 5) {
      rules.push({
        ruleId: 'BEH-006',
        ruleName: 'Multiple Recipients Pattern',
        description: `Sent money to ${uniqueRecipients.count} different recipients in 1 hour`,
        severity: 'HIGH',
        weight: 20,
        triggered: true,
        metadata: { recipientCount: uniqueRecipients.count }
      });
    }

    // Rule 7: Rapid withdrawal after deposit (smurfing)
    if (transaction.type === 'transfer_sent') {
      const recentDeposit = db.prepare(`
        SELECT amount, created_at FROM transactions
        WHERE user_id = ?
        AND type = 'deposit'
        AND status = 'completed'
        AND created_at > datetime('now', '-30 minutes')
        ORDER BY created_at DESC
        LIMIT 1
      `).get(userId);

      if (recentDeposit && Math.abs(recentDeposit.amount - transaction.amount) < 100) {
        rules.push({
          ruleId: 'BEH-007',
          ruleName: 'Rapid Withdrawal After Deposit',
          description: `Withdraw RM${transaction.amount.toFixed(2)} shortly after deposit`,
          severity: 'MEDIUM',
          weight: 15,
          triggered: true,
          metadata: {
            depositAmount: recentDeposit.amount,
            withdrawAmount: transaction.amount
          }
        });
      }
    }

    // Rule 8: Weekend/Holiday activity spike
    const dayOfWeek = currentTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      const weekendTxns = db.prepare(`
        SELECT COUNT(*) as count FROM transactions
        WHERE user_id = ?
        AND created_at > datetime('now', '-24 hours')
      `).get(userId);

      if (weekendTxns.count >= 10) {
        rules.push({
          ruleId: 'BEH-008',
          ruleName: 'High Weekend Activity',
          description: `${weekendTxns.count} transactions on weekend (unusual)`,
          severity: 'LOW',
          weight: 8,
          triggered: true,
          metadata: { count: weekendTxns.count }
        });
      }
    }

    // Rule 9: Same recipient repeatedly
    if (transaction.recipientId) {
      const sameRecipientCount = db.prepare(`
        SELECT COUNT(*) as count FROM transactions
        WHERE user_id = ?
        AND recipient_id = ?
        AND created_at > datetime('now', '-24 hours')
      `).get(userId, transaction.recipientId);

      if (sameRecipientCount.count >= 5) {
        rules.push({
          ruleId: 'BEH-009',
          ruleName: 'Repetitive Recipient Pattern',
          description: `${sameRecipientCount.count} transactions to same recipient in 24h`,
          severity: 'MEDIUM',
          weight: 12,
          triggered: true,
          metadata: { count: sameRecipientCount.count, recipientId: transaction.recipientId }
        });
      }
    }

    // Rule 10: Balance draining (attempting to empty account)
    if (userContext.walletBalance && transaction.amount > userContext.walletBalance * 0.95) {
      rules.push({
        ruleId: 'BEH-010',
        ruleName: 'Account Balance Draining',
        description: `Attempting to withdraw ${((transaction.amount / userContext.walletBalance) * 100).toFixed(0)}% of balance`,
        severity: 'MEDIUM',
        weight: 15,
        triggered: true,
        metadata: {
          balance: userContext.walletBalance,
          amount: transaction.amount,
          percentage: ((transaction.amount / userContext.walletBalance) * 100).toFixed(0)
        }
      });
    }

  } catch (error) {
    console.error('Behavioral check error:', error);
  }

  return { rules };
};

module.exports = {
  checkBehavior
};
