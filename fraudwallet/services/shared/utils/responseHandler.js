/**
 * Standardized API response handler
 * Ensures consistent response format across all microservices
 */

class ResponseHandler {
  /**
   * Success response
   */
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  /**
   * Error response
   */
  static error(res, message = 'An error occurred', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Validation error response
   */
  static validationError(res, errors) {
    return ResponseHandler.error(res, 'Validation failed', 400, errors);
  }

  /**
   * Unauthorized response
   */
  static unauthorized(res, message = 'Unauthorized access') {
    return ResponseHandler.error(res, message, 401);
  }

  /**
   * Forbidden response
   */
  static forbidden(res, message = 'Access forbidden') {
    return ResponseHandler.error(res, message, 403);
  }

  /**
   * Not found response
   */
  static notFound(res, message = 'Resource not found') {
    return ResponseHandler.error(res, message, 404);
  }

  /**
   * Internal server error
   */
  static serverError(res, error, message = 'Internal server error') {
    console.error('Server Error:', error);
    return ResponseHandler.error(res, message, 500);
  }
}

module.exports = ResponseHandler;
