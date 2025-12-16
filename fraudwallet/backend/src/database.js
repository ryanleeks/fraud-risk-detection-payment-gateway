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
      account_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      phone_last_changed DATETIME DEFAULT CURRENT_TIMESTAMP,
      account_status TEXT DEFAULT 'active',
      twofa_enabled INTEGER DEFAULT 0,
      twofa_method TEXT DEFAULT 'email',
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

    if (!columnNames.includes('twofa_enabled')) {
      db.exec("ALTER TABLE users ADD COLUMN twofa_enabled INTEGER DEFAULT 0");
      console.log('✅ Added twofa_enabled column');
    }

    if (!columnNames.includes('twofa_method')) {
      db.exec("ALTER TABLE users ADD COLUMN twofa_method TEXT DEFAULT 'email'");
      console.log('✅ Added twofa_method column');
    }

    if (!columnNames.includes('account_id')) {
      db.exec("ALTER TABLE users ADD COLUMN account_id TEXT");
      console.log('✅ Added account_id column');

      // Generate Account IDs for existing users
      const usersWithoutAccountId = db.prepare('SELECT id FROM users WHERE account_id IS NULL').all();
      if (usersWithoutAccountId.length > 0) {
        const updateStmt = db.prepare('UPDATE users SET account_id = ? WHERE id = ?');
        for (const user of usersWithoutAccountId) {
          const accountId = generateUniqueAccountId();
          updateStmt.run(accountId, user.id);
        }
        console.log(`✅ Generated Account IDs for ${usersWithoutAccountId.length} existing users`);
      }
    }

    if (!columnNames.includes('wallet_balance')) {
      db.exec("ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0.00");
      console.log('✅ Added wallet_balance column');
    }

    if (!columnNames.includes('role')) {
      db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
      console.log('✅ Added role column');
    }

    if (!columnNames.includes('transaction_passcode')) {
      db.exec("ALTER TABLE users ADD COLUMN transaction_passcode TEXT");
      console.log('✅ Added transaction_passcode column');
    }

    if (!columnNames.includes('passcode_attempts')) {
      db.exec("ALTER TABLE users ADD COLUMN passcode_attempts INTEGER DEFAULT 0");
      console.log('✅ Added passcode_attempts column');
    }

    if (!columnNames.includes('passcode_locked_until')) {
      db.exec("ALTER TABLE users ADD COLUMN passcode_locked_until DATETIME");
      console.log('✅ Added passcode_locked_until column');
    }
  } catch (error) {
    console.error('Error adding columns:', error.message);
  }
};

/**
 * Generate a unique 12-digit Account ID
 * Format: 12 random digits (0-9)
 */
const generateUniqueAccountId = () => {
  let accountId;
  let isUnique = false;

  while (!isUnique) {
    // Generate 12 random digits
    accountId = '';
    for (let i = 0; i < 12; i++) {
      accountId += Math.floor(Math.random() * 10);
    }

    // Check if this Account ID already exists
    const existing = db.prepare('SELECT id FROM users WHERE account_id = ?').get(accountId);
    if (!existing) {
      isUnique = true;
    }
  }

  return accountId;
};

// Create verification codes table
const createVerificationCodesTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

  db.exec(sql);
  console.log('✅ Verification codes table is ready');
};

// Create split payments table
const createSplitPaymentsTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS split_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      total_amount REAL NOT NULL,
      num_participants INTEGER NOT NULL,
      amount_per_person REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    )
  `;

  db.exec(sql);
  console.log('✅ Split payments table is ready');
};

// Create split participants table
const createSplitParticipantsTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS split_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      split_payment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      paid INTEGER DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME,
      FOREIGN KEY (split_payment_id) REFERENCES split_payments(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

  db.exec(sql);
  console.log('✅ Split participants table is ready');
};

// Add missing columns to split_participants table
const migrateSplitParticipantsTable = () => {
  try {
    const tableInfo = db.prepare('PRAGMA table_info(split_participants)').all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('paid_at')) {
      db.exec("ALTER TABLE split_participants ADD COLUMN paid_at DATETIME");
      console.log('✅ Added paid_at column to split_participants');
    }
  } catch (error) {
    console.error('Error migrating split_participants table:', error.message);
  }
};

// Create transactions table
const createTransactionsTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      description TEXT,
      stripe_payment_intent_id TEXT,
      recipient_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    )
  `;

  db.exec(sql);
  console.log('✅ Transactions table is ready');
};

// Initialize database
const initDatabase = () => {
  try {
    createUsersTable();
    createVerificationCodesTable();
    createSplitPaymentsTable();
    createSplitParticipantsTable();
    migrateSplitParticipantsTable();
    createTransactionsTable();
    console.log('🎉 Database initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  }
};

// Run initialization
initDatabase();

// Export database instance and utility functions
module.exports = db;
module.exports.generateUniqueAccountId = generateUniqueAccountId;
