// Risk Scoring Algorithm
// Calculates overall fraud risk score from triggered rules

/**
 * Calculate risk score from triggered rules
 * @param {Array} triggeredRules - Array of triggered fraud rules
 * @param {Object} transaction - Transaction details
 * @returns {Object} Risk assessment with score and breakdown
 */
const calculateRiskScore = (triggeredRules, transaction) => {
  if (!triggeredRules || triggeredRules.length === 0) {
    return {
      score: 0,
      level: 'LOW',
      breakdown: {
        baseScore: 0,
        severityMultiplier: 1.0,
        ruleCount: 0,
        categories: {}
      }
    };
  }

  // Calculate base score (sum of all rule weights)
  const baseScore = triggeredRules.reduce((sum, rule) => sum + rule.weight, 0);

  // Apply severity multiplier
  const severityMultiplier = calculateSeverityMultiplier(triggeredRules);

  // Apply rule count multiplier (more rules = higher risk)
  const ruleCountMultiplier = calculateRuleCountMultiplier(triggeredRules.length);

  // Calculate final score
  let finalScore = baseScore * severityMultiplier * ruleCountMultiplier;

  // Cap at 100
  finalScore = Math.min(finalScore, 100);

  // Determine risk level
  const riskLevel = determineRiskLevel(finalScore);

  // Create breakdown by category
  const breakdown = {
    baseScore: baseScore,
    severityMultiplier: severityMultiplier,
    ruleCountMultiplier: ruleCountMultiplier,
    ruleCount: triggeredRules.length,
    categories: categorizeRules(triggeredRules)
  };

  return {
    score: Math.round(finalScore),
    level: riskLevel,
    breakdown: breakdown
  };
};

/**
 * Calculate severity multiplier based on rule severities
 * @param {Array} rules - Triggered rules
 * @returns {number} Multiplier
 */
const calculateSeverityMultiplier = (rules) => {
  const severityCounts = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  };

  rules.forEach(rule => {
    severityCounts[rule.severity] = (severityCounts[rule.severity] || 0) + 1;
  });

  // More HIGH severity rules = higher multiplier
  let multiplier = 1.0;

  if (severityCounts.HIGH >= 3) {
    multiplier = 1.5; // 3+ HIGH severity rules
  } else if (severityCounts.HIGH >= 2) {
    multiplier = 1.3; // 2 HIGH severity rules
  } else if (severityCounts.HIGH >= 1) {
    multiplier = 1.2; // 1 HIGH severity rule
  } else if (severityCounts.MEDIUM >= 3) {
    multiplier = 1.15; // 3+ MEDIUM severity rules
  }

  return multiplier;
};

/**
 * Calculate rule count multiplier
 * @param {number} ruleCount - Number of triggered rules
 * @returns {number} Multiplier
 */
const calculateRuleCountMultiplier = (ruleCount) => {
  if (ruleCount >= 10) return 1.5;  // 10+ rules triggered
  if (ruleCount >= 7) return 1.3;   // 7-9 rules
  if (ruleCount >= 5) return 1.2;   // 5-6 rules
  if (ruleCount >= 3) return 1.1;   // 3-4 rules
  return 1.0;                        // 1-2 rules
};

/**
 * Determine risk level from score
 * @param {number} score - Risk score (0-100)
 * @returns {string} Risk level
 */
const determineRiskLevel = (score) => {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'MINIMAL';
};

/**
 * Categorize rules by type
 * @param {Array} rules - Triggered rules
 * @returns {Object} Rules grouped by category
 */
const categorizeRules = (rules) => {
  const categories = {
    velocity: [],
    amount: [],
    behavioral: [],
    other: []
  };

  rules.forEach(rule => {
    if (rule.ruleId.startsWith('VEL-')) {
      categories.velocity.push(rule);
    } else if (rule.ruleId.startsWith('AMT-')) {
      categories.amount.push(rule);
    } else if (rule.ruleId.startsWith('BEH-')) {
      categories.behavioral.push(rule);
    } else {
      categories.other.push(rule);
    }
  });

  // Calculate category scores
  return {
    velocity: {
      count: categories.velocity.length,
      score: categories.velocity.reduce((sum, r) => sum + r.weight, 0),
      rules: categories.velocity.map(r => r.ruleId)
    },
    amount: {
      count: categories.amount.length,
      score: categories.amount.reduce((sum, r) => sum + r.weight, 0),
      rules: categories.amount.map(r => r.ruleId)
    },
    behavioral: {
      count: categories.behavioral.length,
      score: categories.behavioral.reduce((sum, r) => sum + r.weight, 0),
      rules: categories.behavioral.map(r => r.ruleId)
    }
  };
};

/**
 * Generate human-readable risk summary
 * @param {number} score - Risk score
 * @param {Array} triggeredRules - Triggered rules
 * @returns {string} Summary text
 */
const generateRiskSummary = (score, triggeredRules) => {
  if (score >= 80) {
    return `CRITICAL RISK: ${triggeredRules.length} fraud indicators detected. Transaction blocked for review.`;
  } else if (score >= 60) {
    return `HIGH RISK: ${triggeredRules.length} suspicious patterns found. Manual review required.`;
  } else if (score >= 40) {
    return `MEDIUM RISK: ${triggeredRules.length} potential issues detected. Additional verification recommended.`;
  } else if (score >= 20) {
    return `LOW RISK: ${triggeredRules.length} minor flags raised. Transaction allowed with monitoring.`;
  } else {
    return `MINIMAL RISK: Transaction appears normal.`;
  }
};

module.exports = {
  calculateRiskScore,
  generateRiskSummary
};
