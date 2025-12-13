# AI-Only Fraud Detection with Academic Metrics

## 📋 Overview

This fraud detection system uses **AI-only detection** with **academic-standard evaluation metrics** - perfect for final year projects and research.

### What Changed from Hybrid System

| Feature | Hybrid System (Old) | AI-Only System (New) |
|---------|---------------------|----------------------|
| Detection Method | Rules + AI + Fusion | AI Only (Gemini Pro) |
| Response Time | ~2000ms | ~2000ms |
| Metrics | Basic stats | Full academic metrics |
| Evaluation | None | Confusion matrix, Precision, Recall, F1 |
| Ground Truth | Not tracked | Manual verification system |
| Dataset Export | No | Yes (CSV export) |
| Academic Value | Medium | High |

---

## 🎯 System Architecture

```
Transaction Request
    ↓
┌─────────────────────────────────────────┐
│  AI Analysis (Gemini Pro)               │
│  - Analyzes transaction + user context  │
│  - Returns risk score (0-100)           │
│  - Provides natural language reasoning  │
│  - Lists red flags                      │
│  Response time: ~2000ms                 │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Action Decision                        │
│  - 0-39: ALLOW (low risk)               │
│  - 40-59: CHALLENGE (medium risk)       │
│  - 60-79: REVIEW (high risk)            │
│  - 80-100: BLOCK (critical risk)        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Ground Truth Verification              │
│  - Admin manually reviews transactions  │
│  - Marks as "fraud" or "legitimate"     │
│  - System calculates confusion matrix   │
│  - Updates academic metrics             │
└─────────────────────────────────────────┘
```

---

## 🧪 Academic Metrics Explained

### Confusion Matrix

The foundation of all ML evaluation metrics:

```
                    Predicted Fraud    Predicted Legitimate
Actual Fraud             TP                     FN
                   (True Positive)        (False Negative)

Actual Legitimate        FP                     TN
                   (False Positive)       (True Negative)
```

**Definitions:**

- **True Positive (TP)**: Correctly identified fraud
  - AI flagged it as high-risk (BLOCK/REVIEW), and it was actually fraud ✅

- **False Positive (FP)**: Incorrectly flagged legitimate as fraud
  - AI flagged it as high-risk, but it was actually legitimate ❌
  - This creates false alarms and bad user experience

- **True Negative (TN)**: Correctly allowed legitimate transaction
  - AI allowed it (ALLOW/CHALLENGE), and it was actually legitimate ✅

- **False Negative (FN)**: Missed fraud (most dangerous)
  - AI allowed it, but it was actually fraud ❌
  - This means fraud went through undetected

---

### Performance Metrics

#### 1. **Precision**

**Formula:** `TP / (TP + FP)`

**Meaning:** "Of all transactions we flagged as fraud, how many were actually fraud?"

**Example:**
- Flagged 13 transactions as fraud
- 8 were actually fraud (TP = 8)
- 5 were legitimate (FP = 5)
- **Precision = 8 / 13 = 61.5%**

**Interpretation:**
- High precision = Few false alarms
- Low precision = Too many false positives (user frustration)
- **Target: >75% for good user experience**

---

#### 2. **Recall (Sensitivity)**

**Formula:** `TP / (TP + FN)`

**Meaning:** "Of all actual fraud that occurred, how many did we catch?"

**Example:**
- 10 actual fraud transactions
- Caught 8 (TP = 8)
- Missed 2 (FN = 2)
- **Recall = 8 / 10 = 80%**

**Interpretation:**
- High recall = Catch most fraud (good security)
- Low recall = Missing too much fraud (security risk)
- **Target: >85% for good fraud prevention**

---

#### 3. **F1 Score**

**Formula:** `2 × (Precision × Recall) / (Precision + Recall)`

**Meaning:** Harmonic mean of Precision and Recall (balanced measure)

**Example:**
- Precision = 61.5%
- Recall = 80%
- **F1 = 2 × (0.615 × 0.80) / (0.615 + 0.80) = 69.4%**

**Interpretation:**
- F1 balances both false positives and false negatives
- Better metric than accuracy for imbalanced datasets
- **Target: >70% is good, >80% is excellent**

---

#### 4. **Accuracy**

**Formula:** `(TP + TN) / (TP + TN + FP + FN)`

**Meaning:** "Overall, how many predictions were correct?"

**Example:**
- TP = 8, TN = 85, FP = 5, FN = 2
- Total = 100 transactions
- **Accuracy = (8 + 85) / 100 = 93%**

**Interpretation:**
- Can be misleading for imbalanced datasets
- If 99% of transactions are legitimate, a model that always says "legitimate" gets 99% accuracy!
- **F1 Score is more reliable than Accuracy for fraud detection**

---

#### 5. **Specificity**

**Formula:** `TN / (TN + FP)`

**Meaning:** "Of all legitimate transactions, how many did we correctly allow?"

**Example:**
- 90 legitimate transactions total
- Correctly allowed 85 (TN = 85)
- Incorrectly flagged 5 (FP = 5)
- **Specificity = 85 / 90 = 94.4%**

**Interpretation:**
- High specificity = Few false alarms for legitimate users
- **Target: >90%**

---

#### 6. **False Positive Rate (FPR)**

**Formula:** `FP / (FP + TN)`

**Meaning:** "How often do we incorrectly flag legitimate transactions?"

**Example:**
- FP = 5, TN = 85
- **FPR = 5 / 90 = 5.6%**

**Interpretation:**
- Lower is better
- Each false positive frustrates a legitimate customer
- **Target: <10%**

---

#### 7. **False Negative Rate (FNR)**

**Formula:** `FN / (FN + TP)`

**Meaning:** "How often do we miss actual fraud?"

**Example:**
- FN = 2, TP = 8
- **FNR = 2 / 10 = 20%**

**Interpretation:**
- Lower is better
- Each false negative is fraud that got through
- **Target: <15%**

---

### Example Scenario

**Dataset: 100 verified transactions**
- 90 legitimate, 10 fraud

**AI Performance:**
- Correctly identified 8 fraud (TP = 8)
- Missed 2 fraud (FN = 2)
- Correctly allowed 85 legitimate (TN = 85)
- Incorrectly flagged 5 legitimate (FP = 5)

**Calculated Metrics:**

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Precision** | 61.5% | When AI says fraud, it's right 61.5% of the time |
| **Recall** | 80% | AI catches 80% of all fraud |
| **F1 Score** | 69.4% | Balanced measure (could be better) |
| **Accuracy** | 93% | Overall correctness (but misleading) |
| **Specificity** | 94.4% | 94.4% of legitimate users not bothered |
| **FPR** | 5.6% | 5.6% of good users get false alarms |
| **FNR** | 20% | Missing 20% of fraud (needs improvement) |

**Analysis:**
- ✅ Good recall - catching most fraud
- ⚠️ Moderate precision - too many false alarms
- ❌ 20% FNR means 2 out of 10 fraud transactions slip through
- **Recommendation:** Adjust AI threshold or improve training data

---

## 🚀 How to Use the System

### Step 1: Set Up AI Detection

Ensure Gemini API key is configured:

```bash
# In .env file
GEMINI_API_KEY=your_gemini_api_key_here
```

Restart backend:
```bash
cd fraudwallet/backend
npm run dev
```

Look for:
```
✅ Gemini AI Fraud Detector initialized
✅ Added ground_truth column to fraud_logs
✅ Added verified_at column to fraud_logs
```

---

### Step 2: Let Transactions Flow

As users make transactions, the AI automatically:
1. Analyzes each transaction
2. Generates risk score
3. Logs to database
4. Waits for manual verification

---

### Step 3: Verify Ground Truth (Admin)

**Frontend:** Navigate to "Fraud Verification" tab

You'll see unverified transactions with:
- User details
- Transaction amount
- AI risk score
- AI confidence level
- AI reasoning
- Red flags

**For each transaction, click:**
- **"Mark as Fraud"** if it was actually fraudulent
- **"Mark as Legitimate"** if it was a legitimate transaction

**Tips for verification:**
- Look at AI reasoning
- Check red flags
- Consider transaction patterns
- Consult with domain experts if unsure

---

### Step 4: Review Academic Metrics

**Frontend:** Navigate to "Academic Metrics" tab

View:
- **Confusion Matrix**: Visual representation of TP, FP, TN, FN
- **Performance Metrics**: Precision, Recall, F1, Accuracy
- **Additional Metrics**: Specificity, FPR, FNR, NPV, MCC
- **Statistics**: Verification rate, fraud distribution

---

### Step 5: Export Dataset

Click **"Export CSV"** button to download:
- All verified transactions
- AI predictions
- Ground truth labels
- Suitable for:
  - Thesis appendix
  - Further analysis in Python/R
  - Charts and graphs
  - Research papers

---

## 📊 API Endpoints

### Ground Truth Verification

```bash
# Mark transaction as fraud or legitimate
POST /api/fraud/verify/:logId
Authorization: Bearer <token>
Body: { "groundTruth": "fraud" | "legitimate" }

Response:
{
  "success": true,
  "message": "Ground truth verified successfully",
  "log": { ... }
}
```

### Get Unverified Logs

```bash
GET /api/fraud/unverified-logs?limit=50
Authorization: Bearer <token>

Response:
{
  "success": true,
  "count": 12,
  "logs": [
    {
      "id": 123,
      "user_id": 5,
      "amount": 9800,
      "ai_risk_score": 75,
      "ai_confidence": 85,
      "ai_reasoning": "...",
      "ai_red_flags": ["Structuring pattern", "New account"],
      ...
    }
  ]
}
```

### Get Academic Metrics

```bash
GET /api/fraud/academic-metrics
Authorization: Bearer <token>

Response:
{
  "success": true,
  "metrics": {
    "confusionMatrix": {
      "truePositive": 8,
      "falsePositive": 5,
      "trueNegative": 85,
      "falseNegative": 2,
      "totalVerified": 100
    },
    "metrics": {
      "precision": 61.5,
      "recall": 80.0,
      "f1Score": 69.4,
      "accuracy": 93.0,
      "specificity": 94.4,
      "falsePositiveRate": 5.6,
      "falseNegativeRate": 20.0
    },
    "statistics": { ... }
  }
}
```

### Export Dataset

```bash
GET /api/fraud/export-dataset
Authorization: Bearer <token>

Response: CSV file download
```

---

## 📚 For Your Final Year Project

### What to Include in Your Thesis

#### 1. **Methodology Section**

```
3.2 Fraud Detection System

The fraud detection system employs Google Gemini Pro AI model for
transaction analysis. Each transaction is evaluated based on:
- Transaction amount and type
- User account age and history
- Temporal patterns
- Behavioral anomalies

The AI generates a risk score (0-100) and provides natural language
reasoning for its assessment.

Classification Threshold:
- Low Risk (0-39): Transaction allowed
- Medium Risk (40-59): Additional verification required
- High Risk (60-79): Manual review flagged
- Critical Risk (80-100): Transaction blocked

Ground Truth Labeling:
Manual verification of 100+ transactions was performed to establish
ground truth labels, enabling calculation of standard ML evaluation
metrics.
```

#### 2. **Results Section**

```
4.1 Fraud Detection Performance

The AI-only fraud detection system was evaluated on 100 verified
transactions, comprising 90 legitimate and 10 fraudulent transactions.

Confusion Matrix:
- True Positives (TP): 8
- False Positives (FP): 5
- True Negatives (TN): 85
- False Negatives (FN): 2

Performance Metrics:
- Precision: 61.5%
- Recall (Sensitivity): 80.0%
- F1-Score: 69.4%
- Accuracy: 93.0%
- Specificity: 94.4%

The system demonstrates strong recall (80%), effectively catching
most fraudulent transactions. However, precision (61.5%) indicates
room for improvement in reducing false positives.
```

#### 3. **Discussion Section**

```
5.1 Strengths
- High recall ensures most fraud is detected
- AI provides interpretable reasoning
- Adapts to new fraud patterns
- Natural language explanations aid manual review

5.2 Limitations
- Moderate precision leads to false alarms
- Dependent on external API
- ~2s latency may impact user experience
- Requires manual ground truth verification for metrics

5.3 Future Work
- Fine-tune AI model on domain-specific data
- Implement ensemble approach (multiple AI models)
- Real-time feedback loop for continuous learning
- A/B testing to optimize decision thresholds
```

---

## 🎓 Academic Metric Targets

Based on industry research and academic literature:

| Metric | Good | Excellent | Your Target |
|--------|------|-----------|-------------|
| Precision | >70% | >85% | >75% |
| Recall | >80% | >90% | >85% |
| F1 Score | >70% | >85% | >75% |
| Accuracy | >90% | >95% | >90% |
| FPR | <10% | <5% | <8% |
| FNR | <20% | <10% | <15% |

**Note:** Perfect metrics (100%) are unrealistic. Even commercial fraud detection systems have:
- Precision: 60-80%
- Recall: 70-85%
- F1: 65-80%

Your goal is to demonstrate understanding of these metrics and show reasonable performance.

---

## 🔧 Troubleshooting

### Issue: No metrics showing

**Cause:** No verified transactions yet

**Solution:**
1. Generate some test transactions
2. Navigate to Verification tab
3. Manually verify at least 10-20 transactions
4. Check Academic Metrics tab again

---

### Issue: Metrics seem wrong

**Cause:** Confusion matrix calculation error or threshold mismatch

**Solution:**
1. Check `fraudLogger.js:verifyGroundTruth()` function
2. Verify action_taken mapping:
   - BLOCK/REVIEW = Positive prediction
   - ALLOW/CHALLENGE = Negative prediction
3. Check database: `SELECT * FROM fraud_logs WHERE ground_truth IS NOT NULL`

---

### Issue: Export CSV is empty

**Cause:** No verified transactions

**Solution:** Verify more transactions first

---

## 📖 References

Academic papers for citation:

1. **Confusion Matrix Metrics:**
   - Powers, D. M. (2020). "Evaluation: from precision, recall and F-measure to ROC, informedness, markedness and correlation." *Journal of Machine Learning Technologies*

2. **Imbalanced Dataset Handling:**
   - Chawla, N. V., et al. (2002). "SMOTE: Synthetic Minority Over-sampling Technique." *Journal of Artificial Intelligence Research*

3. **Fraud Detection Evaluation:**
   - Dal Pozzolo, A., et al. (2015). "Learned lessons in credit card fraud detection from a practitioner perspective." *Expert Systems with Applications*

4. **Matthews Correlation Coefficient:**
   - Chicco, D., & Jurman, G. (2020). "The advantages of the Matthews correlation coefficient (MCC) over F1 score and accuracy in binary classification evaluation." *BMC Genomics*

---

## ✅ Summary

**You now have:**

✅ AI-only fraud detection system
✅ Ground truth verification workflow
✅ Full confusion matrix tracking
✅ Industry-standard evaluation metrics:
  - Precision, Recall, F1-Score
  - Accuracy, Specificity
  - FPR, FNR, NPV, MCC
✅ CSV export for further analysis
✅ Professional admin dashboard
✅ Academic-ready documentation

**Perfect for:**
- Final year project demonstration
- Thesis methodology section
- Research paper results
- Academic evaluation
- Portfolio showcase

**Next Steps:**
1. Generate test transactions
2. Verify ground truth labels
3. Build up dataset (100+ transactions)
4. Calculate and analyze metrics
5. Include results in thesis
6. Prepare demo for presentation

Good luck with your final year project! 🎓
