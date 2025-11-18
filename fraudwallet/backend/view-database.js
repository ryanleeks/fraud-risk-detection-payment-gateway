// Simple script to view database contents
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'fraudwallet.db');
const db = new Database(dbPath);

console.log('📊 Database Location:', dbPath);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('👥 USERS TABLE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Get all users
const users = db.prepare('SELECT id, full_name, email, created_at, updated_at, account_status, phone_number, phone_last_changed FROM users').all();

if (users.length === 0) {
  console.log('❌ No users found in database\n');
} else {
  console.log(`✅ Total users: ${users.length}\n`);

  users.forEach((user, index) => {
    console.log(`User #${index + 1}:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.full_name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Created: ${user.created_at}`);
    console.log(`  Updated: ${user.updated_at}`);
    console.log(`  Account Status: ${user.account_status}`);
    console.log(`  Phone Number: ${user.phone_number}`);
    console.log(`  Phone Last Changed: ${user.phone_last_changed}`);
    console.log(`     *** Database and server time are in UTC+0 ***`);
    console.log('');
  });
}

// Get table info
const tableInfo = db.prepare("PRAGMA table_info(users)").all();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 TABLE STRUCTURE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

tableInfo.forEach(column => {
  console.log(`Column: ${column.name}`);
  console.log(`  Type: ${column.type}`);
  console.log(`  Not Null: ${column.notnull ? 'Yes' : 'No'}`);
  console.log(`  Primary Key: ${column.pk ? 'Yes' : 'No'}`);
  console.log('');
});

db.close();
console.log('✅ Database connection closed');
