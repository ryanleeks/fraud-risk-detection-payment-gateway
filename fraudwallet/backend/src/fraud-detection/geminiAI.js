/**
 * GEMINI AI FRAUD DETECTOR (Updated for @google/genai SDK)
 *
 * This module uses Google's Gemini Pro AI to detect fraud patterns in transactions.
 *
 * HOW IT WORKS:
 * 1. Takes transaction data + user context (history, profile, behavior)
 * 2. Builds a detailed prompt asking Gemini to analyze fraud risk
 * 3. Gemini uses its training on billions of patterns to identify suspicious behavior
 * 4. Returns: risk score (0-100), confidence level, reasoning, and red flags
 *
 * ADVANTAGES OVER RULES:
 * - Detects complex patterns rules can't encode
 * - Understands context and temporal relationships
 * - Learns from global fraud patterns
 * - Provides natural language explanations
 *
 * KEY FEATURES:
 * - Error handling with fallback
 * - Rate limiting (15 req/min, 1500/day)
 * - Response time tracking
 * - JSON structured output
 */

const { GoogleGenAI } = require("@google/genai");

class GeminiFraudDetector {
  constructor() {
    // Initialize Gemini API client
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY not set. AI fraud detection will be disabled.');
      this.enabled = false;
      return;
    }

    this.enabled = true;

    // Initialize with new @google/genai SDK
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    // Model configuration
    this.modelName = "gemini-2.0-flash-exp"; // Fast, free model

    // Rate limiting tracking
    this.requestCount = {
      lastMinute: [],
      today: 0,
      lastReset: new Date().toDateString()
    };

    console.log('✅ Gemini AI Fraud Detector initialized');
  }

  /**
   * MAIN ANALYSIS METHOD
   *
   * This is the core method that analyzes a transaction using Gemini AI.
   *
   * @param {Object} transaction - The transaction to analyze
   * @param {Object} userProfile - User account information
   * @param {Array} recentTransactions - Recent transaction history
   * @returns {Object} AI fraud analysis result
   */
  async analyzeTransaction(transaction, userProfile, recentTransactions) {
    if (!this.enabled) {
      return this._getDisabledResponse();
    }

    // Check rate limits (Gemini free tier: 15/min, 1500/day)
    if (this._isRateLimited()) {
      console.warn('⚠️  Gemini rate limit reached, skipping AI analysis');
      return this._getRateLimitedResponse();
    }

    const startTime = Date.now();

    try {
      // Build the fraud analysis prompt
      const prompt = this._buildPrompt(transaction, userProfile, recentTransactions);

      // Call Gemini API with new SDK
      console.log('🤖 Calling Gemini AI for fraud analysis...');

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          temperature: 0.1,  // Low temperature = more consistent
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 1024,
          responseMimeType: "application/json" // Force JSON response
        }
      });

      // Parse JSON response
      const analysisText = response.text;
      const analysis = JSON.parse(analysisText);

      // Track response time
      const responseTime = Date.now() - startTime;

      // Update rate limiting counters
      this._trackRequest();

      console.log(`✅ Gemini analysis complete (${responseTime}ms) - Risk: ${analysis.riskScore}/100`);

      return {
        riskScore: analysis.riskScore,
        confidence: analysis.confidence,
        action: analysis.action,
        reasoning: analysis.reasoning,
        redFlags: analysis.redFlags || [],
        recommendedChecks: analysis.recommendedChecks || [],
        responseTime: responseTime,
        error: false
      };

    } catch (error) {
      console.error('❌ Gemini AI Error:', error.message);
      return this._getErrorResponse(error, Date.now() - startTime);
    }
  }

  /**
   * BUILD FRAUD ANALYSIS PROMPT
   *
   * This creates a detailed prompt that tells Gemini exactly what to analyze.
   * The prompt includes:
   * - Transaction details (amount, type, time)
   * - User context (account age, history, patterns)
   * - Specific fraud indicators to look for
   * - Expected output format
   *
   * WHY THIS WORKS:
   * Gemini has been trained on millions of fraud cases and patterns.
   * By giving it context, it can spot:
   * - Structuring (amounts just below reporting thresholds)
   * - Velocity attacks (rapid transactions)
   * - Account takeover (unusual behavior for this user)
   * - Money laundering (circular transfers, layering)
   * - Card testing (micro-transactions)
   */
  _buildPrompt(transaction, userProfile, recentTransactions) {
    // Calculate user statistics
    const accountAgeInDays = this._getAccountAge(userProfile.created_at);
    const avgTransactionAmount = this._getAverageAmount(recentTransactions);
    const transactionCount24h = recentTransactions.filter(tx =>
      this._isWithinHours(tx.created_at, 24)
    ).length;

    return `You are an expert fraud detection AI system analyzing financial transactions for suspicious activity.

**TRANSACTION BEING ANALYZED:**
- Amount: RM${transaction.amount}
- Type: ${transaction.type}
- Recipient ID: ${transaction.recipientId || 'N/A'}
- Current Time: ${new Date().toISOString()}
- Time of Day: ${new Date().getHours()}:${new Date().getMinutes()}

**USER PROFILE:**
- Account ID: ${userProfile.account_id}
- Account Age: ${accountAgeInDays} days (Created: ${userProfile.created_at})
- Total Historical Transactions: ${recentTransactions.length}
- Transactions in Last 24h: ${transactionCount24h}
- Average Transaction Amount: RM${avgTransactionAmount}
- Current Wallet Balance: RM${userProfile.wallet_balance}
- 2FA Enabled: ${userProfile.twofa_enabled ? 'Yes' : 'No'}

**RECENT TRANSACTION HISTORY (Last 10):**
${recentTransactions.slice(0, 10).map((tx, i) =>
  `${i + 1}. RM${tx.amount} - ${tx.type} - ${tx.created_at} - Status: ${tx.status}`
).join('\n') || 'No recent transactions'}

**FRAUD PATTERNS TO DETECT:**

1. **Structuring (Smurfing)**
   - Transactions just below RM10,000 (reporting threshold)
   - Multiple transactions splitting a large amount
   - Pattern: RM9,500-9,999 range

2. **Velocity Attacks**
   - Rapid succession of transactions
   - Unusual frequency compared to user's normal pattern
   - Multiple recipients in short timeframe

3. **Account Takeover**
   - New account with immediately high-value transactions
   - Sudden change in transaction behavior
   - Transactions at unusual times (2am-6am)

4. **Money Laundering Indicators**
   - Round number transactions (RM1,000, RM5,000, RM10,000)
   - Circular transfers (A→B→A pattern)
   - Rapid deposit followed by withdrawal

5. **Card Testing Fraud**
   - Micro-transactions (< RM1)
   - Testing if card/account is valid

6. **Amount Anomalies**
   - Transaction significantly larger than user's average
   - Unusual decimal precision (e.g., RM1,234.567)

7. **Behavioral Red Flags**
   - Dormant account suddenly active
   - First transaction being high-value
   - Multiple failed attempts before success

**YOUR TASK:**
Analyze this transaction in the context of the user's profile and history. Consider:
- Is the amount suspicious given the user's pattern?
- Is the timing unusual?
- Are there velocity concerns?
- Does this fit known fraud patterns?
- Is this consistent with the user's normal behavior?

**REQUIRED JSON OUTPUT:**
{
  "riskScore": <0-100 integer>,
  "confidence": <0-100 integer - how confident are you in this assessment>,
  "action": "<ALLOW|CHALLENGE|REVIEW|BLOCK>",
  "reasoning": "<2-3 sentences explaining your assessment>",
  "redFlags": ["<specific concern 1>", "<specific concern 2>", ...],
  "recommendedChecks": ["<verification step 1>", "<verification step 2>", ...]
}

**SCORING GUIDELINES:**
- 0-39: Low risk (ALLOW) - Normal transaction
- 40-59: Medium risk (CHALLENGE) - Require additional verification
- 60-79: High risk (REVIEW) - Flag for manual review
- 80-100: Critical risk (BLOCK) - Block transaction immediately

Be thorough, analytical, and specific in your reasoning.`;
  }

  /**
   * HELPER METHODS
   */

  // Calculate account age in days
  _getAccountAge(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now - created;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // Calculate average transaction amount
  _getAverageAmount(transactions) {
    if (!transactions || transactions.length === 0) return 0;
    const sum = transactions.reduce((acc, tx) => acc + parseFloat(tx.amount || 0), 0);
    return (sum / transactions.length).toFixed(2);
  }

  // Check if timestamp is within X hours
  _isWithinHours(timestamp, hours) {
    const txTime = new Date(timestamp);
    const now = new Date();
    const diffHours = (now - txTime) / (1000 * 60 * 60);
    return diffHours <= hours;
  }

  /**
   * RATE LIMITING
   *
   * Gemini free tier limits:
   * - 15 requests per minute
   * - 1,500 requests per day
   *
   * This prevents hitting API limits and getting errors.
   */
  _isRateLimited() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old requests from last minute
    this.requestCount.lastMinute = this.requestCount.lastMinute.filter(
      timestamp => timestamp > oneMinuteAgo
    );

    // Reset daily counter at midnight
    const today = new Date().toDateString();
    if (this.requestCount.lastReset !== today) {
      this.requestCount.today = 0;
      this.requestCount.lastReset = today;
    }

    // Check limits
    if (this.requestCount.lastMinute.length >= 15) {
      return true; // Per-minute limit hit
    }
    if (this.requestCount.today >= 1500) {
      return true; // Daily limit hit
    }

    return false;
  }

  // Track a request for rate limiting
  _trackRequest() {
    this.requestCount.lastMinute.push(Date.now());
    this.requestCount.today++;
  }

  /**
   * ERROR HANDLING RESPONSES
   *
   * When AI fails, we return safe fallback responses.
   * The system will use rule-based detection instead.
   */

  _getDisabledResponse() {
    return {
      riskScore: 0,
      confidence: 0,
      action: 'ALLOW',
      reasoning: 'AI detection disabled (no API key)',
      redFlags: [],
      recommendedChecks: [],
      responseTime: 0,
      error: true,
      errorType: 'DISABLED'
    };
  }

  _getRateLimitedResponse() {
    return {
      riskScore: 0,
      confidence: 0,
      action: 'ALLOW',
      reasoning: 'AI rate limit reached, using rules only',
      redFlags: ['Rate limit exceeded'],
      recommendedChecks: [],
      responseTime: 0,
      error: true,
      errorType: 'RATE_LIMIT'
    };
  }

  _getErrorResponse(error, responseTime) {
    return {
      riskScore: 0,
      confidence: 0,
      action: 'ALLOW',
      reasoning: `AI analysis failed: ${error.message}`,
      redFlags: ['AI analysis unavailable'],
      recommendedChecks: [],
      responseTime: responseTime,
      error: true,
      errorType: 'API_ERROR',
      errorMessage: error.message
    };
  }
}

// Export singleton instance
module.exports = new GeminiFraudDetector();
