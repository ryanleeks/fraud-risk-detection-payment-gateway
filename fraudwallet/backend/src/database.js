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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.exec(sql);
  console.log('✅ Users table is ready');
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
