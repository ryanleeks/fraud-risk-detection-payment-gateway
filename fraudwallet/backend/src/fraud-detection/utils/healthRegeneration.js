/**
 * Health Score Regeneration System
 * Implements time-weighted decay scoring for fair health recovery
 *
 * CONCEPT:
 * - Recent transactions have more weight than old ones
 * - Old fraud scores gradually "decay" and matter less over time
 * - Users can naturally recover from past mistakes through good behavior
 *
 * ALGORITHM:
 * - Uses exponential decay: weight = e^(-days_ago / half_life)
 * - Half-life: Number of days for a score's weight to reduce by 50%
 * - Recency bonus: Last N transactions get extra weight (optional)
 */

const db = require('../../database');

// ==========================================
// CONFIGURATION PARAMETERS
// ==========================================

/**
 * Half-life in days - how long it takes for a score's weight to halve
 * Examples:
 * - 30 days: Aggressive recovery (fraud from 2 months ago barely matters)
 * - 60 days: Balanced recovery (default)
 * - 90 days: Conservative recovery (longer memory)
 */
const DECAY_HALF_LIFE = 60;

/**
 * Lookback period in days - how far back to consider
 * Transactions older than this are excluded entirely
 */
const LOOKBACK_PERIOD_DAYS = 180; // 6 months

/**
 * Minimum weight floor - old scores never go below this weight
 * Prevents completely ignoring very old confirmed fraud
 * 0.05 = 5% minimum weight
 */
const MINIMUM_WEIGHT = 0.05;

/**
 * Recency bonus multiplier for last N transactions
 * Set to 1.0 to disable recency bonus
 */
const RECENCY_BONUS_MULTIPLIER = 1.5;
const RECENCY_BONUS_COUNT = 10;

/**
 * Minimum transaction count for new users
 * Users with fewer transactions get benefit of the doubt
 */
const MIN_TRANSACTION_COUNT = 5;
const NEW_USER_SCORE_CAP = 30; // Cap score at "Good" level

/**
 * Exclude transactions marked as legitimate (successful appeals)
 */
const EXCLUDE_LEGITIMATE = true;

// ==========================================
// CORE CALCULATION FUNCTIONS
// ==========================================

/**
 * Calculate exponential decay weight based on age
 * @param {number} ageInDays - How many days ago the transaction occurred
 * @returns {number} Weight between MINIMUM_WEIGHT and 1.0
 */
const calculateDecayWeight = (ageInDays) => {
  // Exponential decay formula: e^(-age / half_life)
  const weight = Math.exp(-ageInDays / DECAY_HALF_LIFE);

  // Apply minimum weight floor
  return Math.max(weight, MINIMUM_WEIGHT);
};

/**
 * Calculate time-weighted average health score for a user
 * @param {number} userId - User ID
 * @returns {Object} Health score data with breakdown
 */
const calculateTimeWeightedHealthScore = (userId) => {
  try {
    // Build query with optional filters
    let whereClause = 'WHERE user_id = ? AND created_at >= datetime("now", ?)';
    const params = [userId, `-${LOOKBACK_PERIOD_DAYS} days`];

    // Exclude transactions marked as legitimate (successful appeals)
    if (EXCLUDE_LEGITIMATE) {
      whereClause += ' AND (ground_truth IS NULL OR ground_truth != "legitimate")';
    }

    // Fetch fraud logs within lookback period
    const logs = db.prepare(`
      SELECT
        risk_score,
        created_at,
        risk_level,
        action_taken
      FROM fraud_logs
      ${whereClause}
      ORDER BY created_at DESC
    `).all(...params);

    // Handle edge cases
    if (!logs || logs.length === 0) {
      return {
        healthScore: 0,
        transactionCount: 0,
        method: 'none',
        message: 'No fraud logs found'
      };
    }

    // New user protection - cap score for users with few transactions
    if (logs.length < MIN_TRANSACTION_COUNT) {
      const simpleAvg = logs.reduce((sum, log) => sum + log.risk_score, 0) / logs.length;
      const cappedScore = Math.min(simpleAvg, NEW_USER_SCORE_CAP);

      return {
        healthScore: parseFloat(cappedScore.toFixed(2)),
        transactionCount: logs.length,
        method: 'new_user_protection',
        message: `New user with ${logs.length} transactions (score capped at ${NEW_USER_SCORE_CAP})`
      };
    }

    // Calculate time-weighted average
    const now = Date.now();
    let weightedSum = 0;
    let totalWeight = 0;
    let oldestDate = null;
    let newestDate = null;

    logs.forEach((log, index) => {
      const logDate = new Date(log.created_at);
      const ageInDays = (now - logDate.getTime()) / (1000 * 60 * 60 * 24);

      // Track date range
      if (!oldestDate || logDate < oldestDate) oldestDate = logDate;
      if (!newestDate || logDate > newestDate) newestDate = logDate;

      // Calculate decay weight
      let weight = calculateDecayWeight(ageInDays);

      // Apply recency bonus to most recent transactions
      if (index < RECENCY_BONUS_COUNT) {
        weight *= RECENCY_BONUS_MULTIPLIER;
      }

      weightedSum += log.risk_score * weight;
      totalWeight += weight;
    });

    const healthScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Calculate simple average for comparison
    const simpleAvg = logs.reduce((sum, log) => sum + log.risk_score, 0) / logs.length;
    const improvement = simpleAvg - healthScore;

    return {
      healthScore: parseFloat(healthScore.toFixed(2)),
      simpleAverage: parseFloat(simpleAvg.toFixed(2)),
      improvement: parseFloat(improvement.toFixed(2)),
      transactionCount: logs.length,
      dateRange: {
        oldest: oldestDate ? oldestDate.toISOString() : null,
        newest: newestDate ? newestDate.toISOString() : null,
        spanDays: oldestDate && newestDate ?
          Math.round((newestDate - oldestDate) / (1000 * 60 * 60 * 24)) : 0
      },
      method: 'time_weighted_decay',
      config: {
        halfLife: DECAY_HALF_LIFE,
        lookbackDays: LOOKBACK_PERIOD_DAYS,
        minimumWeight: MINIMUM_WEIGHT,
        recencyBonus: RECENCY_BONUS_MULTIPLIER,
        excludeLegitimate: EXCLUDE_LEGITIMATE
      }
    };

  } catch (error) {
    console.error('Calculate time-weighted health score error:', error);
    return {
      healthScore: 0,
      transactionCount: 0,
      method: 'error',
      error: error.message
    };
  }
};

/**
 * Get health recovery estimate
 * Estimates how long until health reaches a target level
 * @param {number} userId - User ID
 * @param {number} targetScore - Target health score (default: 20 for "Good" health)
 * @returns {Object} Recovery estimate
 */
const getHealthRecoveryEstimate = (userId, targetScore = 20) => {
  try {
    const currentHealth = calculateTimeWeightedHealthScore(userId);

    if (currentHealth.healthScore <= targetScore) {
      return {
        recovered: true,
        currentScore: currentHealth.healthScore,
        targetScore: targetScore,
        message: 'Health already at or below target level'
      };
    }

    // Simple estimate: Based on decay rate and current score
    // This is a rough approximation
    const scoreDifference = currentHealth.healthScore - targetScore;
    const decayRate = Math.LN2 / DECAY_HALF_LIFE; // Decay constant

    // Estimate days needed for natural decay
    // Assuming no new high-risk transactions
    const daysToRecover = Math.log(currentHealth.healthScore / targetScore) / decayRate;

    return {
      recovered: false,
      currentScore: currentHealth.healthScore,
      targetScore: targetScore,
      estimatedDays: Math.ceil(daysToRecover),
      estimatedWeeks: Math.ceil(daysToRecover / 7),
      message: `Continue good behavior for approximately ${Math.ceil(daysToRecover)} days`,
      advice: [
        'Make small, regular transactions',
        'Avoid unusual patterns or large amounts',
        'Verify your identity if prompted',
        'Appeal any false fraud flags'
      ]
    };

  } catch (error) {
    console.error('Get health recovery estimate error:', error);
    return {
      recovered: false,
      error: error.message
    };
  }
};

/**
 * Get health score breakdown by time period
 * Shows how health has changed over different time windows
 * @param {number} userId - User ID
 * @returns {Object} Health scores for different time periods
 */
const getHealthScoreTrend = (userId) => {
  try {
    const periods = [
      { label: 'Last 7 days', days: 7 },
      { label: 'Last 30 days', days: 30 },
      { label: 'Last 90 days', days: 90 },
      { label: 'Last 180 days', days: 180 }
    ];

    const trend = periods.map(period => {
      const logs = db.prepare(`
        SELECT
          AVG(risk_score) as avg_score,
          COUNT(*) as count
        FROM fraud_logs
        WHERE user_id = ?
          AND created_at >= datetime('now', ?)
          AND (ground_truth IS NULL OR ground_truth != 'legitimate')
      `).get(userId, `-${period.days} days`);

      return {
        period: period.label,
        days: period.days,
        avgScore: logs.count > 0 ? parseFloat(logs.avg_score.toFixed(2)) : null,
        transactionCount: logs.count
      };
    });

    return {
      userId: userId,
      trend: trend,
      improving: isHealthImproving(trend)
    };

  } catch (error) {
    console.error('Get health score trend error:', error);
    return {
      userId: userId,
      trend: [],
      error: error.message
    };
  }
};

/**
 * Check if health is improving based on trend data
 * @param {Array} trend - Trend data from getHealthScoreTrend
 * @returns {boolean} True if health is improving (scores decreasing)
 */
const isHealthImproving = (trend) => {
  const validScores = trend
    .filter(t => t.avgScore !== null)
    .map(t => t.avgScore);

  if (validScores.length < 2) return false;

  // Compare recent score to older score
  return validScores[0] < validScores[validScores.length - 1];
};

// ==========================================
// CONFIGURATION MANAGEMENT
// ==========================================

/**
 * Get current configuration
 * @returns {Object} Current decay configuration
 */
const getConfiguration = () => {
  return {
    decayHalfLife: DECAY_HALF_LIFE,
    lookbackPeriodDays: LOOKBACK_PERIOD_DAYS,
    minimumWeight: MINIMUM_WEIGHT,
    recencyBonusMultiplier: RECENCY_BONUS_MULTIPLIER,
    recencyBonusCount: RECENCY_BONUS_COUNT,
    minTransactionCount: MIN_TRANSACTION_COUNT,
    newUserScoreCap: NEW_USER_SCORE_CAP,
    excludeLegitimate: EXCLUDE_LEGITIMATE
  };
};

/**
 * Simulate health score with different parameters
 * Useful for testing and tuning the system
 * @param {number} userId - User ID
 * @param {Object} params - Custom parameters to test
 * @returns {Object} Simulated health score
 */
const simulateHealthScore = (userId, params = {}) => {
  // This would require dynamic parameter injection
  // For now, just return current calculation
  // Could be extended to override constants temporarily
  return calculateTimeWeightedHealthScore(userId);
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Main calculation functions
  calculateTimeWeightedHealthScore,
  getHealthRecoveryEstimate,
  getHealthScoreTrend,

  // Configuration
  getConfiguration,
  simulateHealthScore,

  // Utility functions (for testing)
  calculateDecayWeight
};
