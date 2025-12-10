# AI-Powered Fraud Detection with Google Gemini Pro

## 📋 Overview

This fraud detection system now uses a **hybrid approach** combining:
1. **Rule-Based Detection** - Fast, deterministic, explainable fraud rules
2. **AI Detection** - Google Gemini Pro for intelligent pattern recognition
3. **Score Fusion** - Intelligently combines both systems for optimal accuracy

---

## 🎯 How It Works

### **Detection Flow**

```
Transaction Request
    ↓
┌─────────────────────────────────────────┐
│  STEP 1: Rule-Based Detection (~10ms)  │
│  - 19 predefined fraud rules            │
│  - Velocity, Amount, Behavioral checks  │
│  - Generates rule-based score (0-100)   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  STEP 2: AI Analysis (~2000ms)          │
│  - Send transaction + context to Gemini │
│  - AI analyzes patterns and behavior    │
│  - Returns AI score + reasoning         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  STEP 3: Score Fusion                   │
│  - Weighted average of both scores      │
│  - Adjusts based on AI confidence       │
│  - Final score determines action        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  STEP 4: Action Decision                │
│  - 0-39: ALLOW (low risk)               │
│  - 40-59: CHALLENGE (medium risk)       │
│  - 60-79: REVIEW (high risk)            │
│  - 80-100: BLOCK (critical risk)        │
└─────────────────────────────────────────┘
```

---

## 🆚 Rule-Based vs AI Detection

### **Rule-Based Detection**

**How it works:**
- Checks transaction against 19 predefined rules
- Rules are grouped into categories:
  - **Velocity Rules (VEL-)**: Transaction frequency patterns
  - **Amount Rules (AMT-)**: Transaction amount patterns
  - **Behavioral Rules (BEH-)**: User behavior analysis

**Example Rules:**
- `VEL-001`: High frequency (>5 transactions in 1 minute)
- `AMT-002`: Structuring pattern (RM9,500-10,000)
- `BEH-001`: New account high-value transaction

**Strengths:**
- ✅ Fast (<10ms execution time)
- ✅ Explainable (exact rules triggered)
- ✅ Deterministic (same input = same output)
- ✅ No external dependencies

**Weaknesses:**
- ❌ Can't learn from new patterns
- ❌ Requires manual updates
- ❌ Misses subtle correlations
- ❌ Can't understand context

---

### **AI Detection (Gemini Pro)**

**How it works:**
- Sends transaction details + user context to Google Gemini Pro
- AI analyzes using patterns learned from training data
- Returns risk score, confidence level, reasoning, and red flags

**What AI Sees:**
```json
{
  "transaction": {
    "amount": 9800,
    "type": "transfer",
    "time": "2025-12-10T14:30:00Z"
  },
  "userContext": {
    "accountAge": 2,
    "totalTransactions": 45,
    "averageAmount": 150,
    "walletBalance": 5000,
    "recentActivity": [...]
  }
}
```

**AI Analysis Process:**
1. **Pattern Recognition**: Compares to millions of fraud patterns
2. **Contextual Understanding**: "New account + high value + just below threshold = structuring"
3. **Temporal Analysis**: Detects unusual timing patterns
4. **Behavioral Profiling**: Notices deviation from normal user behavior
5. **Natural Language Reasoning**: Explains WHY something is suspicious

**Strengths:**
- ✅ Learns complex patterns
- ✅ Understands context and nuance
- ✅ Adapts to new fraud techniques
- ✅ Provides human-readable explanations
- ✅ Detects subtle correlations

**Weaknesses:**
- ❌ Slower (~2 seconds)
- ❌ Requires internet connection
- ❌ Limited by API rate limits (15/min, 1500/day on free tier)
- ❌ Can be unpredictable
- ❌ Needs good prompts

---

## ⚖️ Score Fusion Logic

The system intelligently combines both scores using these strategies:

### **1. Confidence-Weighted Fusion** (Default)

```javascript
if (AI confidence >= 80%) {
  finalScore = (ruleScore × 30%) + (aiScore × 70%)  // Trust AI more
}
else if (AI confidence >= 50%) {
  finalScore = (ruleScore × 50%) + (aiScore × 50%)  // Balanced
}
else {
  finalScore = (ruleScore × 70%) + (aiScore × 30%)  // Trust rules more
}
```

### **2. Example Scenario**

**Transaction:** RM9,800 transfer from 2-day-old account

**Rule Detection:**
- AMT-002 triggered: Amount near RM10,000 threshold (+20 points)
- BEH-001 triggered: New account high value (+30 points)
- **Rule Score: 50**

**AI Detection:**
- Recognizes: "Classic structuring pattern to avoid reporting threshold"
- Notes: "Account created recently, typical of money laundering setup"
- Detects: "Similar to known fraud patterns in training data"
- **AI Score: 75**
- **Confidence: 85%**

**Combined:**
```
finalScore = (50 × 0.3) + (75 × 0.7) = 67.5 → 68
Action: REVIEW (60-79 range)
Reasoning: "Both systems flagged. Rules: 2 violations. AI: High confidence structuring pattern."
```

---

## 🚀 Setup Instructions

### **Step 1: Get Gemini API Key**

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

**Free Tier Limits:**
- 15 requests per minute
- 1,500 requests per day
- 1.5 million requests per month

### **Step 2: Configure Environment**

Add to your `.env` file:

```bash
# Google Gemini AI Configuration
GEMINI_API_KEY=your_actual_api_key_here
```

### **Step 3: Restart Backend**

```bash
cd fraudwallet/backend
npm run dev
```

You should see:
```
✅ Gemini AI Fraud Detector initialized
```

### **Step 4: Test AI Detection**

Make a transaction and check the backend logs:

```
🔍 Analyzing transaction: RM100 (transfer_sent)
   📋 Rule-based score: 15/100 (0 rules triggered)
   🤖 Running AI analysis...
   🤖 AI score: 20/100 (75% confidence)
   📊 Fusion: Confidence-weighted (AI 75% confident)
   Rules: 15 | AI: 20 (75% conf) → Final: 18
   ⚖️  Final fused score: 18/100 → ALLOW
   ✅ Detection complete (2345ms)
```

---

## 📊 Database Schema

New columns added to `fraud_logs` table:

```sql
rule_based_score INTEGER      -- Score from rule-based detection
ai_risk_score INTEGER          -- Score from AI detection
ai_confidence INTEGER          -- AI confidence level (0-100)
ai_reasoning TEXT              -- Natural language explanation from AI
ai_red_flags TEXT              -- JSON array of red flags detected by AI
ai_response_time INTEGER       -- AI API response time in milliseconds
detection_method TEXT          -- 'rules', 'hybrid', or 'error'
```

---

## 🔌 New API Endpoints

### **1. Get AI Fraud Logs**
```
GET /api/fraud/ai-logs?limit=20&minScore=60
```

Returns fraud logs where AI was used in detection.

**Response:**
```json
{
  "success": true,
  "count": 5,
  "logs": [
    {
      "id": 123,
      "user_id": 1,
      "amount": 9800,
      "risk_score": 68,
      "rule_based_score": 50,
      "ai_risk_score": 75,
      "ai_confidence": 85,
      "ai_reasoning": "Transaction shows classic structuring pattern...",
      "ai_red_flags": ["Structuring pattern", "New account"],
      "detection_method": "hybrid"
    }
  ]
}
```

### **2. Get AI Metrics**
```
GET /api/fraud/ai-metrics
```

Returns AI performance statistics.

**Response:**
```json
{
  "success": true,
  "metrics": {
    "usage": {
      "totalAIChecks": 150,
      "avgAIScore": 35.5,
      "avgConfidence": 78.2,
      "avgResponseTime": 2345,
      "hybridCount": 120,
      "rulesOnlyCount": 30
    },
    "comparison": {
      "avgHybridScore": 42.3,
      "avgRulesScore": 38.7,
      "avgScoreDifference": 12.5
    }
  }
}
```

### **3. Get Disagreement Cases**
```
GET /api/fraud/ai-disagreements?threshold=30&limit=20
```

Returns cases where AI and rules significantly disagreed.

**Response:**
```json
{
  "success": true,
  "disagreements": [
    {
      "id": 456,
      "rule_based_score": 20,
      "ai_risk_score": 75,
      "score_difference": 55,
      "ai_reasoning": "AI detected subtle pattern rules missed...",
      "rules_triggered": ["VEL-003"],
      "ai_red_flags": ["Unusual transaction time", "Multiple recipients"]
    }
  ]
}
```

---

## 🔧 Architecture & Code Structure

### **File Organization**

```
backend/src/fraud-detection/
├── index.js              # Main fraud detection orchestrator (HYBRID)
├── geminiAI.js          # Gemini AI integration (NEW)
├── scoreFusion.js       # Score combining logic (NEW)
├── rules/
│   ├── velocityRules.js
│   ├── amountRules.js
│   └── behavioralRules.js
├── scoring/
│   └── riskScorer.js
└── monitoring/
    ├── fraudLogger.js    # Updated to log AI data
    └── fraudMonitor.js
```

### **Key Components**

#### **1. geminiAI.js** - AI Detector
```javascript
class GeminiFraudDetector {
  // Initializes Gemini API client
  constructor()

  // Main analysis method
  async analyzeTransaction(transaction, userProfile, recentTxs)

  // Builds detailed prompt for AI
  _buildPrompt(transaction, userProfile, recentTxs)

  // Rate limiting (15/min, 1500/day)
  _isRateLimited()

  // Error handling with fallback
  _getErrorResponse(error, responseTime)
}
```

#### **2. scoreFusion.js** - Score Combiner
```javascript
class ScoreFusion {
  // Main fusion method
  static fuseScores(ruleScore, aiScore, aiConfidence, aiError)

  // Different fusion strategies
  static weightedAverageFusion(ruleScore, aiScore, weights)
  static confidenceWeightedFusion(ruleScore, aiScore, confidence)
  static maximumFusion(ruleScore, aiScore)  // Conservative
  static consensusFusion(ruleScore, aiScore) // Agreement-based

  // Determine action from score
  static determineAction(score)
}
```

#### **3. index.js** - Main Orchestrator
```javascript
async function analyzeFraudRisk(transaction, userContext, useAI = true) {
  // STEP 1: Run rule-based detection (always)
  const ruleScore = runAllRules(transaction);

  // STEP 2: Run AI analysis (if enabled)
  const aiAnalysis = await geminiAI.analyzeTransaction(...);

  // STEP 3: Fuse scores
  const finalScore = ScoreFusion.fuseScores(ruleScore, aiScore, confidence);

  // STEP 4: Return comprehensive result
  return {
    riskScore: finalScore,
    action: determineAction(finalScore),
    ruleBasedAnalysis: {...},
    aiAnalysis: {...},
    detectionMethod: 'hybrid'
  };
}
```

---

## 🧪 Testing the System

### **Test Case 1: Normal Transaction**
```bash
Amount: RM100
Expected: Both systems score low (0-20)
Result: ALLOW
```

### **Test Case 2: Structuring Pattern**
```bash
Amount: RM9,850
Account Age: 2 days
Expected: Rules flag AMT-002, AI detects structuring
Result: REVIEW or BLOCK
```

### **Test Case 3: Velocity Attack**
```bash
5 transactions in 1 minute
Expected: Rules flag VEL-001, AI detects unusual frequency
Result: BLOCK
```

### **Test Case 4: AI Advantage**
```bash
Amount: RM500
Time: 3:00 AM
Multiple recipients
Expected: Rules may miss, AI detects suspicious pattern
Result: AI score higher than rules
```

---

## 📈 Monitoring & Analytics

### **Console Output**

Every fraud check logs:
```
🔍 Analyzing transaction: RM9800 (transfer_sent)
   📋 Rule-based score: 50/100 (2 rules triggered)
   🤖 Running AI analysis...
   🤖 AI score: 75/100 (85% confidence)
   📊 Fusion: Confidence-weighted (AI 85% confident)
   Rules: 50 | AI: 75 (85% conf) → Final: 68
   ⚖️  Final fused score: 68/100 → REVIEW
   ✅ Detection complete (2345ms)
```

### **Database Logs**

Every detection saved with:
- Both rule and AI scores
- AI confidence level
- AI reasoning (natural language)
- AI red flags
- Detection method used
- Response times

---

## ⚡ Performance Considerations

### **Latency**
- **Rules only**: ~10ms
- **Hybrid (rules + AI)**: ~2000-3000ms
- **Recommendation**: Show loading indicator to user

### **Rate Limits**
- **Per minute**: 15 requests (Gemini free tier)
- **Per day**: 1,500 requests
- **Fallback**: Automatically uses rules-only if limit hit

### **Cost**
- **Gemini Pro**: FREE (within limits)
- **No additional infrastructure cost**

---

## 🎓 Educational Value

This implementation demonstrates:

1. **Hybrid AI Architecture** - Combining traditional rules with modern AI
2. **Graceful Degradation** - System works even if AI fails
3. **Explainable AI** - Both rule triggers AND AI reasoning
4. **Production Patterns** - Rate limiting, error handling, logging
5. **Score Fusion Techniques** - Confidence-weighted averaging
6. **API Integration** - Google Gemini Pro RESTful API
7. **Security Best Practices** - Environment variables, validation

---

## 🔮 Future Enhancements

1. **Fine-tuning**: Train custom fraud detection model
2. **Feedback Loop**: Learn from blocked vs allowed transactions
3. **Multi-Model**: Combine Gemini with other AI models
4. **Real-time Learning**: Update rules based on AI discoveries
5. **A/B Testing**: Compare hybrid vs rules-only effectiveness

---

## 🆘 Troubleshooting

### **AI Not Running**

Check logs for:
```
⚠️  GEMINI_API_KEY not set. AI fraud detection will be disabled.
```

**Solution**: Add `GEMINI_API_KEY` to `.env` file

### **Rate Limit Errors**

Log shows:
```
⚠️  Gemini rate limit reached, skipping AI analysis
```

**Solution**: Wait 1 minute (15 req/min limit) or 24 hours (1500/day limit)

### **AI Errors**

System automatically falls back to rules:
```
❌ AI analysis failed: Network error
📊 Fusion: Using rules only (AI unavailable)
```

**No transaction is blocked due to AI failure.**

---

## 📚 References

- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Fraud Detection Patterns](https://en.wikipedia.org/wiki/Credit_card_fraud)
- [Score Fusion Techniques](https://en.wikipedia.org/wiki/Ensemble_learning)

---

## ✅ Summary

**You now have:**
- ✅ Hybrid fraud detection (rules + AI)
- ✅ Natural language fraud explanations
- ✅ Intelligent score fusion
- ✅ Graceful fallback mechanisms
- ✅ Comprehensive logging and analytics
- ✅ Production-ready error handling

**The system is:**
- 🚀 Fast when possible (rules)
- 🧠 Smart when needed (AI)
- 🛡️ Reliable always (fallback)
- 📊 Transparent throughout (logging)
