// Database configuration for Fraud Service
const Database = require('better-sqlite3');
const path = require('path');

// Connect to shared database
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'fraudwallet.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('🔍 Fraud Service connected to database:', dbPath);

// Create fraud_logs table if it doesn't exist
const createFraudLogsTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS fraud_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      recipient_id INTEGER,
      risk_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      rules_triggered TEXT DEFAULT '[]',
      ip_address TEXT,
      device_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

  try {
    db.exec(sql);
    console.log('✅ Fraud logs table is ready');
  } catch (error) {
    console.error('❌ Error creating fraud_logs table:', error.message);
  }
};

// Initialize
createFraudLogsTable();

module.exports = db;
