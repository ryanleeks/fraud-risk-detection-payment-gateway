// Main Fraud Detection Engine
// Coordinates all fraud detection rules and scoring

const velocityRules = require('./rules/velocityRules');
const amountRules = require('./rules/amountRules');
const behavioralRules = require('./rules/behavioralRules');
const riskScorer = require('./scoring/riskScorer');
const fraudLogger = require('./monitoring/fraudLogger');

/**
 * Main fraud detection function
 * Analyzes a transaction and returns fraud assessment
 *
 * @param {Object} transaction - Transaction details
 * @param {number} transaction.userId - User ID
 * @param {number} transaction.amount - Transaction amount
 * @param {string} transaction.type - Transaction type (transfer_sent, deposit, etc)
 * @param {number} transaction.recipientId - Recipient ID (optional)
 * @param {Object} userContext - Additional user context
 * @returns {Object} Fraud assessment result
 */
const analyzeFraudRisk = async (transaction, userContext = {}) => {
  const startTime = Date.now();

  try {
    // Collect all triggered rules
    const triggeredRules = [];

    // Run velocity checks
    const velocityChecks = await velocityRules.checkVelocity(transaction, userContext);
    triggeredRules.push(...velocityChecks.rules);

    // Run amount checks
    const amountChecks = amountRules.checkAmount(transaction, userContext);
    triggeredRules.push(...amountChecks.rules);

    // Run behavioral checks
    const behavioralChecks = await behavioralRules.checkBehavior(transaction, userContext);
    triggeredRules.push(...behavioralChecks.rules);

    // Calculate risk score
    const riskAssessment = riskScorer.calculateRiskScore(triggeredRules, transaction);

    // Determine action
    const action = determineAction(riskAssessment.score);

    // Prepare result
    const result = {
      fraudulent: action === 'BLOCK',
      riskScore: riskAssessment.score,
      riskLevel: riskAssessment.level,
      action: action,
      triggeredRules: triggeredRules,
      riskBreakdown: riskAssessment.breakdown,
      executionTime: Date.now() - startTime
    };

    // Log for monitoring and analysis
    await fraudLogger.logFraudCheck(transaction, result);

    return result;

  } catch (error) {
    console.error('❌ Fraud detection error:', error);

    // On error, allow transaction but log the issue
    return {
      fraudulent: false,
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      action: 'ALLOW',
      triggeredRules: [],
      error: error.message,
      executionTime: Date.now() - startTime
    };
  }
};

/**
 * Determine action based on risk score
 * @param {number} score - Risk score (0-100)
 * @returns {string} Action to take
 */
const determineAction = (score) => {
  if (score >= 80) return 'BLOCK';      // Critical risk - block transaction
  if (score >= 60) return 'REVIEW';     // High risk - flag for manual review
  if (score >= 40) return 'CHALLENGE';  // Medium risk - require 2FA/verification
  return 'ALLOW';                        // Low risk - allow transaction
};

/**
 * Get fraud statistics for a user
 * @param {number} userId - User ID
 * @returns {Object} User fraud statistics
 */
const getUserFraudStats = async (userId) => {
  return await fraudLogger.getUserStats(userId);
};

/**
 * Get overall fraud detection metrics
 * @returns {Object} System-wide fraud metrics
 */
const getSystemMetrics = async () => {
  return await fraudLogger.getSystemMetrics();
};

module.exports = {
  analyzeFraudRisk,
  getUserFraudStats,
  getSystemMetrics
};
