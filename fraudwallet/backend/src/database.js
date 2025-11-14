// Database configuration using SQLite
const Database = require('better-sqlite3');
const path = require('path');

// Create or connect to database file
const dbPath = path.join(__dirname, '..', 'fraudwallet.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('📦 Connected to SQLite database:', dbPath);

// Create users table if it doesn't exist
const createUsersTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      account_status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.exec(sql);
  console.log('✅ Users table is ready');

  // Add account_status column if it doesn't exist (for existing databases)
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasAccountStatus = columns.some(col => col.name === 'account_status');

    if (!hasAccountStatus) {
      db.exec("ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active'");
      console.log('✅ Added account_status column to existing users table');
    }
  } catch (error) {
    // Column might already exist, ignore error
  }
};

// Initialize database
const initDatabase = () => {
  try {
    createUsersTable();
    console.log('🎉 Database initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  }
};

// Run initialization
initDatabase();

// Export database instance
module.exports = db;
