// Script to create first admin user
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// Initialize database (this will create all tables)
const db = require('../src/database');

console.log('📦 Database initialized');

/**
 * Generate a unique 12-digit Account ID
 */
const generateUniqueAccountId = () => {
  let accountId;
  let isUnique = false;

  while (!isUnique) {
    accountId = '';
    for (let i = 0; i < 12; i++) {
      accountId += Math.floor(Math.random() * 10);
    }

    const existing = db.prepare('SELECT id FROM users WHERE account_id = ?').get(accountId);
    if (!existing) {
      isUnique = true;
    }
  }

  return accountId;
};

/**
 * Create admin user
 */
const createAdminUser = async () => {
  try {
    // Admin user details
    const adminEmail = 'admin@fraudwallet.com';
    const adminPassword = 'admin123456'; // Change this to a secure password
    const adminFullName = 'System Administrator';
    const adminPhone = '60123456789';

    // Check if admin already exists
    const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('📧 Email:', adminEmail);
      console.log('🆔 Account ID:', existingAdmin.account_id);

      // Update existing user to admin role
      db.prepare('UPDATE users SET role = ? WHERE email = ?').run('admin', adminEmail);
      console.log('✅ Updated user role to admin');

      db.close();
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    // Generate Account ID
    const accountId = generateUniqueAccountId();

    // Insert admin user
    const insertUser = db.prepare(`
      INSERT INTO users (account_id, full_name, email, password_hash, phone_number, phone_last_changed, role)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'admin')
    `);

    const result = insertUser.run(accountId, adminFullName, adminEmail, passwordHash, adminPhone);

    console.log('✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('🆔 Account ID:', accountId);
    console.log('👤 User ID:', result.lastInsertRowid);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  IMPORTANT: Please change the admin password after first login!');

    db.close();

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    db.close();
    process.exit(1);
  }
};

// Run the script
createAdminUser();
