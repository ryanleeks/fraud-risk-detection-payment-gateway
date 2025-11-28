const { Pool } = require('pg');

/**
 * PostgreSQL Database Connection Pool
 * Shared across all microservices
 */
class Database {
  constructor() {
    this.pool = null;
  }

  /**
   * Initialize database connection pool
   * @param {Object} config - Database configuration
   */
  async initialize(config = {}) {
    const dbConfig = {
      host: config.host || process.env.DB_HOST || 'postgres',
      port: config.port || process.env.DB_PORT || 5432,
      database: config.database || process.env.DB_NAME || 'fraudwallet',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD || 'postgres123',
      max: config.max || 20, // Maximum number of clients in the pool
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: config.connectionTimeout || 2000,
    };

    this.pool = new Pool(dbConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('❌ Unexpected database pool error:', err);
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connected successfully');
      client.release();
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
      throw err;
    }

    return this.pool;
  }

  /**
   * Execute a query
   * @param {string} text - SQL query
   * @param {Array} params - Query parameters
   */
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('📊 Query executed', { text, duration, rows: res.rowCount });
      return res;
    } catch (err) {
      console.error('❌ Query error:', { text, error: err.message });
      throw err;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Close all connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 Database pool closed');
    }
  }
}

// Singleton instance
const database = new Database();

module.exports = database;
