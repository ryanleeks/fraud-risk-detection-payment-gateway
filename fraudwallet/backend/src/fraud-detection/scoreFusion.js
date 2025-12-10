/**
 * SCORE FUSION MODULE
 *
 * This module combines fraud scores from two detection systems:
 * 1. Rule-based system (fast, deterministic, explainable)
 * 2. AI system (smart, contextual, pattern-learning)
 *
 * WHY COMBINE BOTH?
 * - Rules catch known, well-defined fraud patterns
 * - AI catches subtle, complex patterns rules can't encode
 * - Hybrid system = best of both worlds
 * - Fallback: if AI fails, rules still work
 *
 * FUSION STRATEGIES:
 * 1. Weighted Average - Balance both systems
 * 2. Confidence-Weighted - Trust high-confidence AI more
 * 3. Maximum - Take the higher score (conservative)
 * 4. Consensus - Both must agree to flag
 */

class ScoreFusion {
  /**
   * MAIN FUSION METHOD
   *
   * Combines rule-based and AI scores using intelligent weighting.
   *
   * @param {number} ruleScore - Score from rule-based detection (0-100)
   * @param {number} aiScore - Score from AI detection (0-100)
   * @param {number} aiConfidence - AI's confidence in its score (0-100)
   * @param {boolean} aiError - Whether AI analysis failed
   * @returns {number} Combined score (0-100)
   */
  static fuseScores(ruleScore, aiScore, aiConfidence = 50, aiError = false) {
    // If AI failed, use rules only
    if (aiError || aiScore === null || aiScore === undefined) {
      console.log('📊 Fusion: Using rules only (AI unavailable)');
      return Math.round(ruleScore);
    }

    // If AI has no confidence, use rules
    if (aiConfidence < 20) {
      console.log('📊 Fusion: Using rules only (AI low confidence)');
      return Math.round(ruleScore);
    }

    // Choose fusion strategy based on confidence
    let fusedScore;

    if (aiConfidence >= 80) {
      // High AI confidence: trust AI more (70% AI, 30% rules)
      fusedScore = this.confidenceWeightedFusion(ruleScore, aiScore, aiConfidence);
      console.log(`📊 Fusion: Confidence-weighted (AI ${aiConfidence}% confident)`);
    } else if (aiConfidence >= 50) {
      // Medium AI confidence: balanced (50% AI, 50% rules)
      fusedScore = this.weightedAverageFusion(ruleScore, aiScore, 0.5, 0.5);
      console.log('📊 Fusion: Balanced average (50/50)');
    } else {
      // Low AI confidence: trust rules more (70% rules, 30% AI)
      fusedScore = this.weightedAverageFusion(ruleScore, aiScore, 0.7, 0.3);
      console.log('📊 Fusion: Rule-weighted (AI low confidence)');
    }

    // Ensure score stays within bounds
    fusedScore = Math.max(0, Math.min(100, Math.round(fusedScore)));

    console.log(`   Rules: ${ruleScore} | AI: ${aiScore} (${aiConfidence}% conf) → Final: ${fusedScore}`);

    return fusedScore;
  }

  /**
   * WEIGHTED AVERAGE FUSION
   *
   * Simple weighted average of both scores.
   * Default: 50% rules, 50% AI (balanced)
   *
   * Example:
   *   ruleScore = 60, aiScore = 80, weights = 0.5/0.5
   *   result = (60 × 0.5) + (80 × 0.5) = 70
   */
  static weightedAverageFusion(ruleScore, aiScore, ruleWeight = 0.5, aiWeight = 0.5) {
    return (ruleScore * ruleWeight) + (aiScore * aiWeight);
  }

  /**
   * CONFIDENCE-WEIGHTED FUSION
   *
   * Adjusts weights based on AI confidence.
   * Higher AI confidence = trust AI more.
   *
   * Formula:
   *   aiWeight = aiConfidence / 100
   *   ruleWeight = 1 - aiWeight
   *
   * Example:
   *   AI 90% confident → 90% AI, 10% rules
   *   AI 60% confident → 60% AI, 40% rules
   *   AI 30% confident → 30% AI, 70% rules
   */
  static confidenceWeightedFusion(ruleScore, aiScore, aiConfidence) {
    const aiWeight = aiConfidence / 100;
    const ruleWeight = 1 - aiWeight;
    return (ruleScore * ruleWeight) + (aiScore * aiWeight);
  }

  /**
   * MAXIMUM FUSION (Conservative)
   *
   * Takes the higher score from both systems.
   * Use this for zero-tolerance fraud prevention.
   *
   * If EITHER system flags it high, treat as high risk.
   */
  static maximumFusion(ruleScore, aiScore) {
    return Math.max(ruleScore, aiScore);
  }

  /**
   * MINIMUM FUSION (Permissive)
   *
   * Takes the lower score from both systems.
   * Use this to reduce false positives.
   *
   * BOTH systems must agree it's risky to flag it.
   */
  static minimumFusion(ruleScore, aiScore) {
    return Math.min(ruleScore, aiScore);
  }

  /**
   * CONSENSUS FUSION
   *
   * Both systems must agree within a threshold.
   * If they disagree significantly, flag for manual review.
   *
   * Example:
   *   Rules: 30, AI: 35 → Agree (low risk) → 33
   *   Rules: 75, AI: 70 → Agree (high risk) → 73
   *   Rules: 20, AI: 80 → Disagree → 60 (force REVIEW)
   */
  static consensusFusion(ruleScore, aiScore, disagreementThreshold = 30) {
    const difference = Math.abs(ruleScore - aiScore);

    if (difference > disagreementThreshold) {
      // Systems disagree - flag for manual review (score 60)
      console.log(`⚠️  Systems disagree: Rules ${ruleScore} vs AI ${aiScore}`);
      return 60; // Forces REVIEW action
    }

    // Systems agree - use average
    return (ruleScore + aiScore) / 2;
  }

  /**
   * DETERMINE ACTION FROM SCORE
   *
   * Converts numerical score to action decision.
   *
   * Thresholds:
   *   0-39: ALLOW - Low risk, proceed with transaction
   *   40-59: CHALLENGE - Medium risk, require additional verification
   *   60-79: REVIEW - High risk, flag for manual review
   *   80-100: BLOCK - Critical risk, reject transaction
   */
  static determineAction(score) {
    if (score >= 80) return 'BLOCK';
    if (score >= 60) return 'REVIEW';
    if (score >= 40) return 'CHALLENGE';
    return 'ALLOW';
  }

  /**
   * ANALYZE AGREEMENT
   *
   * Checks if rule-based and AI systems agree or disagree.
   * Useful for monitoring and improving the system.
   *
   * @returns {Object} Agreement analysis
   */
  static analyzeAgreement(ruleScore, aiScore, aiConfidence) {
    const difference = Math.abs(ruleScore - aiScore);
    const ruleAction = this.determineAction(ruleScore);
    const aiAction = this.determineAction(aiScore);

    return {
      scoreDifference: difference,
      ruleAction: ruleAction,
      aiAction: aiAction,
      actionsAgree: ruleAction === aiAction,
      agreement: difference <= 10 ? 'STRONG' :
                 difference <= 30 ? 'MODERATE' :
                 difference <= 50 ? 'WEAK' : 'DISAGREE',
      aiConfidenceLevel: aiConfidence >= 80 ? 'HIGH' :
                         aiConfidence >= 50 ? 'MEDIUM' : 'LOW'
    };
  }
}

module.exports = ScoreFusion;
