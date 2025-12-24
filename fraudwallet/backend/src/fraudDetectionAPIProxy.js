// Fraud Detection API Proxy
// Proxies fraud detection requests to the fraud detection microservice

const FRAUD_SERVICE_URL = process.env.FRAUD_SERVICE_URL || 'http://localhost:8085';

/**
 * Get fraud detection statistics for current user
 */
const getUserFraudStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const response = await fetch(`${FRAUD_SERVICE_URL}/user-stats/${userId}`);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    console.error('Get user fraud stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fraud statistics'
    });
  }
};

/**
 * Get system-wide fraud detection metrics
 */
const getSystemMetrics = async (req, res) => {
  try {
    const response = await fetch(`${FRAUD_SERVICE_URL}/system-metrics`);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    console.error('Get system metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system metrics'
    });
  }
};

/**
 * Get recent fraud detection logs for user
 */
const getRecentFraudLogs = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const response = await fetch(`${FRAUD_SERVICE_URL}/recent-logs?userId=${userId}&limit=${limit}`);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    console.error('Get fraud logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fraud logs'
    });
  }
};

/**
 * Get high-risk users and transactions
 */
const getHighRiskUsers = async (req, res) => {
  try {
    const { limit = 20, minScore = 60 } = req.query;

    const response = await fetch(`${FRAUD_SERVICE_URL}/high-risk-users?limit=${limit}&minScore=${minScore}`);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    console.error('Get high-risk users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching high-risk users'
    });
  }
};

/**
 * Get top flagged users (proxy to existing DB query for now)
 */
const getTopFlaggedUsers = async (req, res) => {
  try {
    const { limit = 10, minScore = 60 } = req.query;

    // For now, proxy to high-risk-users
    const response = await fetch(`${FRAUD_SERVICE_URL}/high-risk-users?limit=${limit}&minScore=${minScore}`);
    const data = await response.json();

    res.status(200).json({
      success: true,
      count: data.count || 0,
      topFlaggedUsers: data.highRiskUsers || []
    });
  } catch (error) {
    console.error('Get top flagged users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top flagged users'
    });
  }
};

/**
 * Get fraud statistics for a specific user
 */
const getUserFraudDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const response = await fetch(`${FRAUD_SERVICE_URL}/user-stats/${userId}`);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    console.error('Get user fraud details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user fraud details'
    });
  }
};

module.exports = {
  getUserFraudStats,
  getSystemMetrics,
  getRecentFraudLogs,
  getHighRiskUsers,
  getTopFlaggedUsers,
  getUserFraudDetails
};
