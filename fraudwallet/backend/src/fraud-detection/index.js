// Main Fraud Detection Engine
// AI-ONLY DETECTION with Academic Metrics
// Uses Google Gemini Pro for intelligent fraud pattern recognition

const fraudLogger = require('./monitoring/fraudLogger');
const geminiAI = require('./geminiAI');
const db = require('../database');
const { getLocationFromIP, checkLocationChange } = require('./utils/geolocation');

/**
 * Main fraud detection function - AI-ONLY SYSTEM
 * Analyzes a transaction using Google Gemini Pro AI
 *
 * EXECUTION FLOW:
 * 1. Prepare user context (profile + transaction history)
 * 2. Send to Gemini AI for analysis
 * 3. Use AI score directly (no fusion)
 * 4. Log with ground truth tracking for academic metrics
 *
 * @param {Object} transaction - Transaction details
 * @param {number} transaction.userId - User ID
 * @param {number} transaction.amount - Transaction amount
 * @param {string} transaction.type - Transaction type (transfer_sent, deposit, etc)
 * @param {number} transaction.recipientId - Recipient ID (optional)
 * @param {Object} userContext - Additional user context (optional)
 * @returns {Object} Fraud assessment result
 */
const analyzeFraudRisk = async (transaction, userContext = {}) => {
  const startTime = Date.now();

  try {
    console.log(`\n🔍 AI-Only Fraud Detection: RM${transaction.amount} (${transaction.type})`);

    // Check if AI is enabled
    if (!geminiAI.enabled) {
      console.warn('⚠️  AI detection disabled - GEMINI_API_KEY not configured');
      return {
        fraudulent: false,
        riskScore: 0,
        riskLevel: 'UNKNOWN',
        action: 'ALLOW',
        triggeredRules: [],
        detectionMethod: 'disabled',
        error: 'AI detection disabled',
        executionTime: Date.now() - startTime
      };
    }

    // ==========================================
    // STEP 1: PREPARE CONTEXT FOR AI
    // ==========================================
    const userProfile = await getUserProfile(transaction.userId);
    const recentTransactions = await getRecentTransactions(transaction.userId);

    // Get location data from IP address
    const ipAddress = transaction.ipAddress || transaction.ip;
    const currentLocation = getLocationFromIP(ipAddress);
    const locationCheck = await checkLocationChange(transaction.userId, currentLocation);

    console.log(`   📊 Context: ${recentTransactions.length} recent transactions, account age ${getAccountAgeDays(userProfile.created_at)} days`);
    console.log(`   📍 Location: ${currentLocation.city}, ${currentLocation.country} (IP: ${currentLocation.ip})`);

    if (locationCheck.suspicious) {
      console.log(`   ⚠️  ${locationCheck.message}`);
    } else if (locationCheck.locationChanged) {
      console.log(`   ℹ️  ${locationCheck.message}`);
    }

    // ==========================================
    // STEP 2: AI ANALYSIS (Only detection method)
    // ==========================================
    console.log(`   🤖 Sending to Gemini AI for analysis...`);

    let aiAnalysis;
    try {
      aiAnalysis = await geminiAI.analyzeTransaction(
        transaction,
        userProfile,
        recentTransactions
      );
    } catch (error) {
      console.error('   ❌ AI analysis failed:', error.message);
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

    // Handle AI errors (rate limit, network, etc.)
    if (aiAnalysis.error) {
      console.warn(`   ⚠️  AI unavailable: ${aiAnalysis.errorType}`);
      return {
        fraudulent: false,
        riskScore: 0,
        riskLevel: 'UNKNOWN',
        action: 'ALLOW',
        triggeredRules: [],
        detectionMethod: 'error',
        error: aiAnalysis.errorType,
        executionTime: Date.now() - startTime
      };
    }

    // ==========================================
    // STEP 3: USE AI SCORE DIRECTLY
    // ==========================================
    const finalScore = aiAnalysis.riskScore;
    const action = determineAction(finalScore);
    const riskLevel = getRiskLevel(finalScore);

    console.log(`   🤖 AI Risk Score: ${finalScore}/100 (${aiAnalysis.confidence}% confidence)`);
    console.log(`   🎯 Action: ${action} | Risk Level: ${riskLevel}`);
    console.log(`   💬 Reasoning: ${aiAnalysis.reasoning}`);

    if (aiAnalysis.redFlags && aiAnalysis.redFlags.length > 0) {
      console.log(`   🚩 Red Flags: ${aiAnalysis.redFlags.join(', ')}`);
    }

    // ==========================================
    // STEP 4: PREPARE RESULT
    // ==========================================
    const result = {
      fraudulent: action === 'BLOCK',
      riskScore: finalScore,
      riskLevel: riskLevel,
      action: action,
      triggeredRules: [], // No rules in AI-only mode
      detectionMethod: 'ai',

      // AI analysis
      aiAnalysis: {
        riskScore: aiAnalysis.riskScore,
        confidence: aiAnalysis.confidence,
        reasoning: aiAnalysis.reasoning,
        redFlags: aiAnalysis.redFlags,
        recommendedChecks: aiAnalysis.recommendedChecks,
        responseTime: aiAnalysis.responseTime
      },

      executionTime: Date.now() - startTime
    };

    // Add location data to transaction for logging
    transaction.locationData = {
      ...currentLocation,
      locationChanged: locationCheck.locationChanged,
      suspicious: locationCheck.suspicious,
      distance: locationCheck.distance,
      speed: locationCheck.speed
    };

    // Log for monitoring and academic metrics tracking
    const logId = await fraudLogger.logFraudCheck(transaction, result);

    // Add logId to result so it can be saved with the transaction
    result.logId = logId;

    console.log(`   ✅ AI Detection complete (${result.executionTime}ms)\n`);

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
 * Calculate account age in days
 */
const getAccountAgeDays = (createdAt) => {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now - created;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
