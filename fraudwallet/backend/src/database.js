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
      phone_number TEXT NOT NULL,
      phone_last_changed DATETIME DEFAULT CURRENT_TIMESTAMP,
      account_status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.exec(sql);
  console.log('✅ Users table is ready');

  // Add missing columns if they don't exist (for existing databases)
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const columnNames = columns.map(col => col.name);

    if (!columnNames.includes('account_status')) {
      db.exec("ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active'");
      console.log('✅ Added account_status column');
    }

    if (!columnNames.includes('phone_number')) {
      db.exec("ALTER TABLE users ADD COLUMN phone_number TEXT");
      console.log('✅ Added phone_number column');
    }

    if (!columnNames.includes('phone_last_changed')) {
      db.exec("ALTER TABLE users ADD COLUMN phone_last_changed DATETIME");
      // Set default value for existing rows
      db.exec("UPDATE users SET phone_last_changed = CURRENT_TIMESTAMP WHERE phone_last_changed IS NULL");
      console.log('✅ Added phone_last_changed column');
    }
  } catch (error) {
    console.error('Error adding columns:', error.message);
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
