// Main Fraud Detection Engine
// Coordinates all fraud detection rules and scoring
// NOW WITH AI INTEGRATION (Gemini Pro)

const velocityRules = require('./rules/velocityRules');
const amountRules = require('./rules/amountRules');
const behavioralRules = require('./rules/behavioralRules');
const riskScorer = require('./scoring/riskScorer');
const fraudLogger = require('./monitoring/fraudLogger');
const geminiAI = require('./geminiAI');
const ScoreFusion = require('./scoreFusion');
const db = require('../database');

/**
 * Main fraud detection function - HYBRID SYSTEM (Rules + AI)
 * Analyzes a transaction using both rule-based and AI detection
 *
 * EXECUTION FLOW:
 * 1. Run rule-based detection (fast, ~10ms)
 * 2. Run AI analysis in parallel (slower, ~2s)
 * 3. Fuse scores intelligently
 * 4. Return comprehensive result
 *
 * @param {Object} transaction - Transaction details
 * @param {number} transaction.userId - User ID
 * @param {number} transaction.amount - Transaction amount
 * @param {string} transaction.type - Transaction type (transfer_sent, deposit, etc)
 * @param {number} transaction.recipientId - Recipient ID (optional)
 * @param {Object} userContext - Additional user context
 * @param {boolean} useAI - Whether to use AI detection (default: true)
 * @returns {Object} Fraud assessment result
 */
const analyzeFraudRisk = async (transaction, userContext = {}, useAI = true) => {
  const startTime = Date.now();

  try {
    console.log(`\n🔍 Analyzing transaction: RM${transaction.amount} (${transaction.type})`);

    // ==========================================
    // STEP 1: RULE-BASED DETECTION (Always runs)
    // ==========================================
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

    // Calculate rule-based risk score
    const ruleAssessment = riskScorer.calculateRiskScore(triggeredRules, transaction);
    const ruleScore = ruleAssessment.score;

    console.log(`   📋 Rule-based score: ${ruleScore}/100 (${triggeredRules.length} rules triggered)`);

    // ==========================================
    // STEP 2: AI DETECTION (Parallel analysis)
    // ==========================================
    let aiAnalysis = null;
    let detectionMethod = 'rules';

    if (useAI && geminiAI.enabled) {
      try {
        console.log(`   🤖 Running AI analysis...`);

        // Prepare context for AI
        const userProfile = await getUserProfile(transaction.userId);
        const recentTransactions = await getRecentTransactions(transaction.userId);

        // Call Gemini AI
        aiAnalysis = await geminiAI.analyzeTransaction(
          transaction,
          userProfile,
          recentTransactions
        );

        if (!aiAnalysis.error) {
          detectionMethod = 'hybrid';
          console.log(`   🤖 AI score: ${aiAnalysis.riskScore}/100 (${aiAnalysis.confidence}% confidence)`);
        } else {
          console.log(`   ⚠️  AI unavailable: ${aiAnalysis.errorType}`);
        }

      } catch (error) {
        console.error('   ❌ AI analysis failed:', error.message);
        aiAnalysis = { error: true, riskScore: 0 };
      }
    }

    // ==========================================
    // STEP 3: SCORE FUSION
    // ==========================================
    let finalScore = ruleScore;
    let action = determineAction(ruleScore);

    if (aiAnalysis && !aiAnalysis.error) {
      // Fuse rule-based and AI scores
      finalScore = ScoreFusion.fuseScores(
        ruleScore,
        aiAnalysis.riskScore,
        aiAnalysis.confidence,
        false
      );
      action = determineAction(finalScore);

      console.log(`   ⚖️  Final fused score: ${finalScore}/100 → ${action}`);
    }

    // ==========================================
    // STEP 4: PREPARE COMPREHENSIVE RESULT
    // ==========================================
    const result = {
      fraudulent: action === 'BLOCK',
      riskScore: finalScore,
      riskLevel: getRiskLevel(finalScore),
      action: action,
      triggeredRules: triggeredRules,
      riskBreakdown: ruleAssessment.breakdown,
      detectionMethod: detectionMethod,

      // Rule-based analysis
      ruleBasedAnalysis: {
        score: ruleScore,
        triggeredRules: triggeredRules,
        level: ruleAssessment.level
      },

      // AI analysis (if available)
      aiAnalysis: aiAnalysis && !aiAnalysis.error ? {
        riskScore: aiAnalysis.riskScore,
        confidence: aiAnalysis.confidence,
        reasoning: aiAnalysis.reasoning,
        redFlags: aiAnalysis.redFlags,
        recommendedChecks: aiAnalysis.recommendedChecks,
        responseTime: aiAnalysis.responseTime
      } : null,

      executionTime: Date.now() - startTime
    };

    // Log for monitoring and analysis
    await fraudLogger.logFraudCheck(transaction, result);

    console.log(`   ✅ Detection complete (${result.executionTime}ms)\n`);

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
      detectionMethod: 'error',
      error: error.message,
      executionTime: Date.now() - startTime
    };
  }
};

/**
 * Get user profile for AI context
 */
const getUserProfile = async (userId) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    return user || {};
  } catch (error) {
    console.error('Error getting user profile:', error);
    return {};
  }
};

/**
 * Get recent transactions for AI context
 */
const getRecentTransactions = async (userId, hours = 24) => {
  try {
    const transactions = db.prepare(`
      SELECT * FROM transactions
      WHERE user_id = ?
      AND created_at > datetime('now', '-${hours} hours')
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);
    return transactions || [];
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    return [];
  }
};

/**
 * Get risk level from score
 */
const getRiskLevel = (score) => {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'MINIMAL';
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
