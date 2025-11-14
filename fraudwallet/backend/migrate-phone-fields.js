// Migration script to add phone number fields to existing database
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'fraudwallet.db');
console.log('📦 Connecting to database:', dbPath);

const db = new Database(dbPath);

try {
  // Check current columns
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const columnNames = columns.map(col => col.name);

  console.log('\n📋 Current columns:', columnNames.join(', '));

  // Add phone_number column if missing
  if (!columnNames.includes('phone_number')) {
    console.log('\n➕ Adding phone_number column...');
    db.exec("ALTER TABLE users ADD COLUMN phone_number TEXT");
    console.log('✅ Added phone_number column');
  } else {
    console.log('✅ phone_number column already exists');
  }

  // Add phone_last_changed column if missing
  if (!columnNames.includes('phone_last_changed')) {
    console.log('\n➕ Adding phone_last_changed column...');
    db.exec("ALTER TABLE users ADD COLUMN phone_last_changed DATETIME");
    console.log('✅ Added phone_last_changed column');

    // Set default value for existing rows
    console.log('\n🔄 Setting default values for existing rows...');
    db.exec("UPDATE users SET phone_last_changed = CURRENT_TIMESTAMP WHERE phone_last_changed IS NULL");
    console.log('✅ Default values set');
  } else {
    console.log('✅ phone_last_changed column already exists');
  }

  // Verify the migration
  const updatedColumns = db.prepare("PRAGMA table_info(users)").all();
  console.log('\n📋 Updated columns:', updatedColumns.map(col => col.name).join(', '));

  console.log('\n🎉 Migration completed successfully!');
  console.log('\n⚠️  Note: Existing users will need to add their phone numbers.');
  console.log('    You may want to make phone_number NOT NULL after users update their profiles.\n');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
