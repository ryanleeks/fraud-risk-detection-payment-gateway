// Middleware for JWT authentication
const jwt = require('jsonwebtoken');

/**
 * Verify JWT Token
 * This middleware checks if the user is logged in
 * It extracts the token from the Authorization header
 */
const verifyToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    // Format: "Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login first.'
      });
    }

    // Extract token (remove "Bearer " prefix)
    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');

    // Add user info to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user'
    };

    // Continue to next middleware or route handler
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please login again.'
    });
  }
};

/**
 * Verify Admin Token
 * This middleware checks if the user is logged in AND has admin role
 */
const verifyAdminToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login first.'
      });
    }

    // Extract token
    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');

    // Check if user has admin role
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Add user info to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    // Continue to next middleware or route handler
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please login again.'
    });
  }
};

module.exports = {
  verifyToken,
  verifyAdminToken
};
