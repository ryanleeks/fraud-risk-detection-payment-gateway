// Fraud Service HTTP Client
// This replaces the local fraud-detection module with HTTP calls to the microservice

const FRAUD_SERVICE_URL = process.env.FRAUD_SERVICE_URL || 'http://localhost:8085';

/**
 * Analyze fraud risk by calling the fraud detection microservice
 */
const analyzeFraudRisk = async (transactionData, userData) => {
  try {
    const response = await fetch(`${FRAUD_SERVICE_URL}/check-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: transactionData.userId,
        transactionType: transactionData.type,
        amount: transactionData.amount,
        recipientId: transactionData.recipientId
      })
    });

    if (!response.ok) {
      console.error('❌ Fraud service error:', response.status);
      // Fallback: Allow transaction if fraud service is down (fail-open)
      // In production, you might want to fail-closed
      return {
        riskScore: 0,
        riskLevel: 'UNKNOWN',
        action: 'ALLOW',
        triggeredRules: [],
        message: 'Fraud service unavailable - transaction allowed by default'
      };
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Fraud service returned error');
    }

    return {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      action: result.action,
      triggeredRules: result.triggeredRules || []
    };

  } catch (error) {
    console.error('❌ Fraud service call failed:', error.message);
    // Fallback: Allow transaction if service is unreachable
    return {
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      action: 'ALLOW',
      triggeredRules: [],
      message: 'Fraud service unavailable - transaction allowed by default'
    };
  }
};

/**
 * Check transaction for fraud (alias for analyzeFraudRisk)
 */
const checkTransaction = async (transactionData) => {
  return analyzeFraudRisk(transactionData, {});
};

module.exports = {
  analyzeFraudRisk,
  checkTransaction
};
