// Academic Metrics Calculator
// Calculates industry-standard ML evaluation metrics for fraud detection
// Includes: Precision, Recall, F1-Score, Accuracy, Specificity, FPR, etc.

const db = require('../../database');

/**
 * Get confusion matrix from verified fraud logs
 * @returns {Object} Confusion matrix with TP, FP, TN, FN counts
 */
const getConfusionMatrix = () => {
  try {
    const matrix = db.prepare(`
      SELECT
        SUM(is_true_positive) as TP,
        SUM(is_false_positive) as FP,
        SUM(is_true_negative) as TN,
        SUM(is_false_negative) as FN,
        COUNT(*) as total_verified
      FROM fraud_logs
      WHERE ground_truth IS NOT NULL
    `).get();

    return {
      truePositive: matrix.TP || 0,
      falsePositive: matrix.FP || 0,
      trueNegative: matrix.TN || 0,
      falseNegative: matrix.FN || 0,
      totalVerified: matrix.total_verified || 0
    };
  } catch (error) {
    console.error('Get confusion matrix error:', error);
    return {
      truePositive: 0,
      falsePositive: 0,
      trueNegative: 0,
      falseNegative: 0,
      totalVerified: 0
    };
  }
};

/**
 * Calculate all academic metrics from confusion matrix
 * @param {Object} matrix - Confusion matrix {TP, FP, TN, FN}
 * @returns {Object} All calculated metrics
 */
const calculateMetrics = (matrix) => {
  const { truePositive: TP, falsePositive: FP, trueNegative: TN, falseNegative: FN } = matrix;

  // Prevent division by zero
  const safeDiv = (numerator, denominator) => {
    return denominator === 0 ? 0 : numerator / denominator;
  };

  // Calculate metrics
  const precision = safeDiv(TP, (TP + FP));  // Of flagged fraud, how many were actually fraud?
  const recall = safeDiv(TP, (TP + FN));     // Of all actual fraud, how many did we catch?
  const specificity = safeDiv(TN, (TN + FP)); // Of all legitimate, how many did we correctly allow?
  const accuracy = safeDiv((TP + TN), (TP + TN + FP + FN)); // Overall correctness
  const f1Score = safeDiv((2 * precision * recall), (precision + recall)); // Harmonic mean of precision and recall
  const falsePositiveRate = safeDiv(FP, (FP + TN)); // How often do we incorrectly flag legitimate?
  const falseNegativeRate = safeDiv(FN, (FN + TP)); // How often do we miss fraud?
  const npv = safeDiv(TN, (TN + FN)); // Negative Predictive Value: Of allowed transactions, how many were actually legitimate?

  // Matthews Correlation Coefficient (good for imbalanced datasets)
  const mccNumerator = (TP * TN) - (FP * FN);
  const mccDenominator = Math.sqrt((TP + FP) * (TP + FN) * (TN + FP) * (TN + FN));
  const mcc = mccDenominator === 0 ? 0 : mccNumerator / mccDenominator;

  return {
    // Basic metrics (percentages)
    precision: parseFloat((precision * 100).toFixed(2)),
    recall: parseFloat((recall * 100).toFixed(2)),
    specificity: parseFloat((specificity * 100).toFixed(2)),
    accuracy: parseFloat((accuracy * 100).toFixed(2)),
    f1Score: parseFloat((f1Score * 100).toFixed(2)),

    // Error rates
    falsePositiveRate: parseFloat((falsePositiveRate * 100).toFixed(2)),
    falseNegativeRate: parseFloat((falseNegativeRate * 100).toFixed(2)),

    // Additional metrics
    negativePredictiveValue: parseFloat((npv * 100).toFixed(2)),
    matthewsCorrelationCoefficient: parseFloat(mcc.toFixed(4)),

    // Raw values for reference
    rawMetrics: {
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      specificity: parseFloat(specificity.toFixed(4)),
      accuracy: parseFloat(accuracy.toFixed(4)),
      f1Score: parseFloat(f1Score.toFixed(4))
    }
  };
};

/**
 * Get comprehensive academic metrics report
 * @returns {Object} Full metrics report with confusion matrix and all metrics
 */
const getAcademicMetrics = () => {
  try {
    // Get confusion matrix
    const confusionMatrix = getConfusionMatrix();

    // Calculate all metrics
    const metrics = calculateMetrics(confusionMatrix);

    // Get additional statistics
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_logs,
        COUNT(CASE WHEN ground_truth IS NOT NULL THEN 1 END) as verified_count,
        COUNT(CASE WHEN ground_truth IS NULL THEN 1 END) as unverified_count,
        COUNT(CASE WHEN ground_truth = 'fraud' THEN 1 END) as actual_fraud_count,
        COUNT(CASE WHEN ground_truth = 'legitimate' THEN 1 END) as actual_legitimate_count,
        AVG(CASE WHEN ground_truth IS NOT NULL THEN ai_confidence END) as avg_confidence_verified,
        AVG(CASE WHEN ground_truth IS NOT NULL THEN ai_risk_score END) as avg_risk_score_verified
      FROM fraud_logs
    `).get();

    // Get action distribution
    const actionDistribution = db.prepare(`
      SELECT
        action_taken,
        COUNT(*) as count,
        AVG(ai_risk_score) as avg_score
      FROM fraud_logs
      WHERE ground_truth IS NOT NULL
      GROUP BY action_taken
    `).all();

    return {
      confusionMatrix: confusionMatrix,
      metrics: metrics,
      statistics: {
        totalLogs: stats.total_logs || 0,
        verifiedCount: stats.verified_count || 0,
        unverifiedCount: stats.unverified_count || 0,
        actualFraudCount: stats.actual_fraud_count || 0,
        actualLegitimateCount: stats.actual_legitimate_count || 0,
        avgConfidenceVerified: stats.avg_confidence_verified ? parseFloat(stats.avg_confidence_verified.toFixed(2)) : 0,
        avgRiskScoreVerified: stats.avg_risk_score_verified ? parseFloat(stats.avg_risk_score_verified.toFixed(2)) : 0,
        verificationRate: stats.total_logs > 0 ? parseFloat(((stats.verified_count / stats.total_logs) * 100).toFixed(2)) : 0
      },
      actionDistribution: actionDistribution,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Get academic metrics error:', error);
    return {
      error: error.message,
      confusionMatrix: { TP: 0, FP: 0, TN: 0, FN: 0, totalVerified: 0 },
      metrics: {},
      statistics: {}
    };
  }
};

/**
 * Get metrics history over time
 * @param {number} days - Number of days to look back
 * @param {string} interval - 'day' or 'week'
 * @returns {Array} Historical metrics grouped by time period
 */
const getMetricsHistory = (days = 30, interval = 'day') => {
  try {
    const intervalFormat = interval === 'week' ? '%Y-W%W' : '%Y-%m-%d';

    const history = db.prepare(`
      SELECT
        strftime('${intervalFormat}', verified_at) as period,
        SUM(is_true_positive) as TP,
        SUM(is_false_positive) as FP,
        SUM(is_true_negative) as TN,
        SUM(is_false_negative) as FN,
        COUNT(*) as total,
        AVG(ai_confidence) as avg_confidence,
        AVG(ai_risk_score) as avg_risk_score
      FROM fraud_logs
      WHERE ground_truth IS NOT NULL
      AND verified_at > datetime('now', '-${days} days')
      GROUP BY period
      ORDER BY period ASC
    `).all();

    // Calculate metrics for each period
    return history.map(row => {
      const matrix = {
        truePositive: row.TP || 0,
        falsePositive: row.FP || 0,
        trueNegative: row.TN || 0,
        falseNegative: row.FN || 0,
        totalVerified: row.total || 0
      };

      const metrics = calculateMetrics(matrix);

      return {
        period: row.period,
        confusionMatrix: matrix,
        precision: metrics.precision,
        recall: metrics.recall,
        f1Score: metrics.f1Score,
        accuracy: metrics.accuracy,
        avgConfidence: row.avg_confidence ? parseFloat(row.avg_confidence.toFixed(2)) : 0,
        avgRiskScore: row.avg_risk_score ? parseFloat(row.avg_risk_score.toFixed(2)) : 0
      };
    });
  } catch (error) {
    console.error('Get metrics history error:', error);
    return [];
  }
};

/**
 * Get detailed breakdown of false positives and false negatives
 * @param {number} limit - Number of records per category
 * @returns {Object} FP and FN cases with details
 */
const getErrorAnalysis = (limit = 20) => {
  try {
    // False Positives: Flagged as fraud but actually legitimate
    const falsePositives = db.prepare(`
      SELECT
        fl.*,
        u.full_name,
        u.account_id,
        u.email
      FROM fraud_logs fl
      JOIN users u ON fl.user_id = u.id
      WHERE fl.is_false_positive = 1
      ORDER BY fl.ai_risk_score DESC
      LIMIT ?
    `).all(limit);

    // False Negatives: Allowed but actually fraud
    const falseNegatives = db.prepare(`
      SELECT
        fl.*,
        u.full_name,
        u.account_id,
        u.email
      FROM fraud_logs fl
      JOIN users u ON fl.user_id = u.id
      WHERE fl.is_false_negative = 1
      ORDER BY fl.created_at DESC
      LIMIT ?
    `).all(limit);

    // Parse JSON fields
    const parseLog = (log) => ({
      ...log,
      ai_red_flags: log.ai_red_flags ? JSON.parse(log.ai_red_flags) : []
    });

    return {
      falsePositives: falsePositives.map(parseLog),
      falseNegatives: falseNegatives.map(parseLog),
      fpCount: falsePositives.length,
      fnCount: falseNegatives.length
    };
  } catch (error) {
    console.error('Get error analysis error:', error);
    return {
      falsePositives: [],
      falseNegatives: [],
      fpCount: 0,
      fnCount: 0
    };
  }
};

/**
 * Get performance metrics by risk score threshold
 * Useful for ROC curve analysis
 * @returns {Array} Metrics at different thresholds
 */
const getThresholdAnalysis = () => {
  try {
    const thresholds = [20, 30, 40, 50, 60, 70, 80, 90];
    const results = [];

    thresholds.forEach(threshold => {
      const stats = db.prepare(`
        SELECT
          COUNT(CASE WHEN ai_risk_score >= ? AND ground_truth = 'fraud' THEN 1 END) as TP,
          COUNT(CASE WHEN ai_risk_score >= ? AND ground_truth = 'legitimate' THEN 1 END) as FP,
          COUNT(CASE WHEN ai_risk_score < ? AND ground_truth = 'legitimate' THEN 1 END) as TN,
          COUNT(CASE WHEN ai_risk_score < ? AND ground_truth = 'fraud' THEN 1 END) as FN
        FROM fraud_logs
        WHERE ground_truth IS NOT NULL
      `).get(threshold, threshold, threshold, threshold);

      const matrix = {
        truePositive: stats.TP || 0,
        falsePositive: stats.FP || 0,
        trueNegative: stats.TN || 0,
        falseNegative: stats.FN || 0
      };

      const metrics = calculateMetrics(matrix);

      results.push({
        threshold: threshold,
        ...matrix,
        precision: metrics.precision,
        recall: metrics.recall,
        f1Score: metrics.f1Score,
        fpr: metrics.falsePositiveRate,
        tpr: metrics.recall // True Positive Rate = Recall
      });
    });

    return results;
  } catch (error) {
    console.error('Get threshold analysis error:', error);
    return [];
  }
};

/**
 * Export dataset for academic analysis (CSV format)
 * @returns {string} CSV data
 */
const exportDataset = () => {
  try {
    const logs = db.prepare(`
      SELECT
        fl.id,
        fl.user_id,
        fl.amount,
        fl.transaction_type,
        fl.ai_risk_score,
        fl.ai_confidence,
        fl.action_taken,
        fl.ground_truth,
        fl.is_true_positive,
        fl.is_false_positive,
        fl.is_true_negative,
        fl.is_false_negative,
        fl.created_at,
        fl.verified_at
      FROM fraud_logs fl
      WHERE fl.ground_truth IS NOT NULL
      ORDER BY fl.created_at DESC
    `).all();

    // Convert to CSV
    const headers = [
      'id', 'user_id', 'amount', 'transaction_type', 'ai_risk_score',
      'ai_confidence', 'action_taken', 'ground_truth', 'is_true_positive',
      'is_false_positive', 'is_true_negative', 'is_false_negative',
      'created_at', 'verified_at'
    ];

    let csv = headers.join(',') + '\n';

    logs.forEach(log => {
      const row = headers.map(header => {
        const value = log[header];
        return value !== null && value !== undefined ? value : '';
      });
      csv += row.join(',') + '\n';
    });

    return csv;
  } catch (error) {
    console.error('Export dataset error:', error);
    return '';
  }
};

module.exports = {
  getConfusionMatrix,
  calculateMetrics,
  getAcademicMetrics,
  getMetricsHistory,
  getErrorAnalysis,
  getThresholdAnalysis,
  exportDataset
};
