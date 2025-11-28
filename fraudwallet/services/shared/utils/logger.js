/**
 * Centralized logging utility for all microservices
 * Provides consistent logging format across services
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

class Logger {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
  }

  _formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      message,
      ...meta
    });
  }

  error(message, error = null) {
    const meta = error ? { error: error.message, stack: error.stack } : {};
    console.error(this._formatMessage(LOG_LEVELS.ERROR, message, meta));
  }

  warn(message, meta = {}) {
    console.warn(this._formatMessage(LOG_LEVELS.WARN, message, meta));
  }

  info(message, meta = {}) {
    console.log(this._formatMessage(LOG_LEVELS.INFO, message, meta));
  }

  debug(message, meta = {}) {
    if (this.logLevel === 'DEBUG') {
      console.log(this._formatMessage(LOG_LEVELS.DEBUG, message, meta));
    }
  }

  // Request logging middleware
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.info('HTTP Request', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip
        });
      });

      next();
    };
  }
}

module.exports = Logger;
