# 🔍 Fraud Detection Monitoring Guide

## Quick Access Methods

### 1. 📊 **Run the Monitoring Dashboard** (Recommended)

```bash
cd fraudwallet/backend
node src/fraud-detection/monitoring/fraudMonitor.js
```

This will show you:
- ✅ High-risk users (score >= 60)
- ✅ Top flagged users
- ✅ Most triggered fraud rules
- ✅ System-wide statistics
- ✅ Risk level distribution

---

### 2. 🌐 **API Endpoints** (For Integration)

#### **A. Check YOUR fraud stats**
```bash
curl http://localhost:8080/api/fraud/user-stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalChecks": 5,
    "averageRiskScore": 23.4,
    "maxRiskScore": 45,
    "blockedTransactions": 0,
    "reviewedTransactions": 1,
    "criticalRiskCount": 0,
    "highRiskCount": 1
  }
}
```

---

#### **B. View high-risk users**
```bash
curl "http://localhost:8080/api/fraud/high-risk-users?limit=10&minScore=60" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "highRiskUsers": [
    {
      "user_id": 5,
      "full_name": "John Doe",
      "account_id": "123456789012",
      "risk_score": 85,
      "risk_level": "CRITICAL",
      "action_taken": "BLOCK",
      "amount": 75000,
      "transaction_type": "transfer_sent",
      "rules_triggered": ["AMT-001", "VEL-001", "BEH-005"],
      "created_at": "2025-11-23T10:30:00Z"
    }
  ]
}
```

---

#### **C. Get top flagged users (last 7 days)**
```bash
curl "http://localhost:8080/api/fraud/top-flagged-users?limit=10&days=7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### **D. Get specific user's fraud details**
```bash
curl http://localhost:8080/api/fraud/user/5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### **E. System-wide metrics**
```bash
curl http://localhost:8080/api/fraud/system-metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### **F. Your recent fraud logs**
```bash
curl "http://localhost:8080/api/fraud/recent-logs?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. 💾 **Direct Database Queries**

#### **Check fraud_logs table**
```bash
cd fraudwallet/backend
sqlite3 fraudwallet.db

# View all high-risk transactions
SELECT * FROM fraud_logs WHERE risk_score >= 60 ORDER BY created_at DESC LIMIT 20;

# Get user fraud summary
SELECT
  user_id,
  COUNT(*) as total_checks,
  AVG(risk_score) as avg_score,
  MAX(risk_score) as max_score
FROM fraud_logs
GROUP BY user_id
ORDER BY avg_score DESC;

# Most triggered rules
SELECT rules_triggered, COUNT(*) as frequency
FROM fraud_logs
WHERE rules_triggered != '[]'
GROUP BY rules_triggered
ORDER BY frequency DESC
LIMIT 10;
```

---

## 🧪 How to Test Fraud Detection

### **Test 1: Trigger High Frequency Rule (VEL-001)**

Send 6 transfers within 1 minute:

```bash
# Terminal 1: Login and get token
TOKEN="your_jwt_token_here"

# Send 6 transfers rapidly
for i in {1..6}; do
  curl http://localhost:8080/api/wallet/send \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "recipientId": 2,
      "amount": 10,
      "note": "Test transfer '$i'"
    }'
  sleep 5  # Wait 5 seconds between transfers
done
```

**Expected:** Rule VEL-001 triggers (High Frequency Transactions)

---

### **Test 2: Trigger Large Amount Rule (AMT-001)**

```bash
curl http://localhost:8080/api/wallet/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": 2,
    "amount": 60000,
    "note": "Large transfer test"
  }'
```

**Expected:**
- Rule AMT-001 triggers (Large Single Transaction)
- Risk score likely HIGH or CRITICAL
- May be BLOCKED if score >= 80

---

### **Test 3: Trigger Structuring Rule (AMT-002)**

```bash
curl http://localhost:8080/api/wallet/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": 2,
    "amount": 9999,
    "note": "Just below threshold"
  }'
```

**Expected:** Rule AMT-002 triggers (Structuring Pattern)

---

### **Test 4: Check Results**

After running tests, check what happened:

```bash
# View your fraud stats
curl http://localhost:8080/api/fraud/user-stats \
  -H "Authorization: Bearer $TOKEN"

# View recent logs
curl http://localhost:8080/api/fraud/recent-logs?limit=10 \
  -H "Authorization: Bearer $TOKEN"

# Or run the monitoring dashboard
node src/fraud-detection/monitoring/fraudMonitor.js
```

---

## 📈 Understanding Fraud Scores

| Score Range | Risk Level | Action | Meaning |
|-------------|-----------|---------|---------|
| 0-19 | MINIMAL | ALLOW | Normal transaction |
| 20-39 | LOW | ALLOW | Minor flags, monitored |
| 40-59 | MEDIUM | CHALLENGE | Require 2FA verification |
| 60-79 | HIGH | REVIEW | Flag for manual review |
| 80-100 | CRITICAL | BLOCK | **Transaction blocked** |

---

## 🚨 Common Fraud Rules That Get Triggered

### **High Risk (25-30 points):**
- **VEL-001**: High frequency (>5 txns/minute)
- **AMT-001**: Large transaction (>RM50,000)
- **AMT-002**: Structuring (RM9,500-RM9,999)
- **BEH-001**: New account high-value
- **BEH-005**: Circular transfer pattern

### **Medium Risk (15-20 points):**
- **VEL-002**: Rapid sequential (<5 seconds)
- **AMT-006**: Amount deviation (10x average)
- **BEH-009**: Repetitive recipient (5+ times)

### **Low Risk (5-10 points):**
- **BEH-004**: Unusual time (2-6 AM)
- **AMT-008**: Unusual decimal precision

---

## 📊 For Your Thesis/Research

### **Data to Collect:**

1. **Detection Accuracy**
   - True Positives: Actual fraud caught
   - False Positives: Legit transactions flagged
   - False Negatives: Fraud missed
   - True Negatives: Legit transactions allowed

2. **Performance Metrics**
   - Average execution time (<100ms target)
   - Throughput (checks/second)
   - Database query time

3. **Rule Effectiveness**
   - Which rules trigger most often
   - Which rules have highest scores
   - Combinations that lead to blocks

4. **User Behavior Analysis**
   - Transaction patterns before fraud
   - Time-based fraud trends
   - Amount distribution in fraud

### **How to Export Data for Analysis:**

```bash
# Export all fraud logs to CSV
sqlite3 fraudwallet.db <<EOF
.headers on
.mode csv
.output fraud_logs_export.csv
SELECT * FROM fraud_logs;
.quit
EOF

# Now open fraud_logs_export.csv in Excel/Python for analysis
```

---

## 🔧 Troubleshooting

**Q: No fraud logs appearing?**
- Make sure you're making actual transfers (not just viewing pages)
- Check if fraud detection is integrated (look for 🔍 in console logs)
- Verify fraud_logs table exists: `sqlite3 fraudwallet.db "SELECT COUNT(*) FROM fraud_logs;"`

**Q: All transactions getting blocked?**
- Check if you're triggering multiple rules simultaneously
- Reduce amounts or frequency for testing
- Review rules in `fraud-detection/rules/` folder

**Q: Want to adjust thresholds?**
- Edit rule weights in `/fraud-detection/rules/*.js`
- Modify action thresholds in `/fraud-detection/index.js` (line 56-60)

---

## 📞 Quick Commands Cheat Sheet

```bash
# Run monitoring dashboard
node src/fraud-detection/monitoring/fraudMonitor.js

# Check your stats
curl http://localhost:8080/api/fraud/user-stats -H "Authorization: Bearer $TOKEN"

# View high-risk users
curl "http://localhost:8080/api/fraud/high-risk-users?limit=20" -H "Authorization: Bearer $TOKEN"

# Check database
sqlite3 fraudwallet.db "SELECT * FROM fraud_logs ORDER BY created_at DESC LIMIT 10;"

# Export for thesis
sqlite3 fraudwallet.db ".mode csv" ".output fraud_data.csv" "SELECT * FROM fraud_logs;" ".quit"
```

---

**✅ You now have complete fraud detection monitoring capabilities!**

For academic purposes, this gives you:
- Real-time fraud detection
- Comprehensive logging
- Quantifiable metrics
- Research data for analysis
- Industry-standard rule-based approach
