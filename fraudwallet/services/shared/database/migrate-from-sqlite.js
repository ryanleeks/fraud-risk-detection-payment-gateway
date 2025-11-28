/**
 * Migration tool to migrate data from SQLite to PostgreSQL
 * Run this to transfer existing data to the new microservices database
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

// SQLite database path
const sqlitePath = path.join(__dirname, '../../../backend/fraudwallet.db');

// PostgreSQL configuration
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fraudwallet',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
};

async function migrate() {
  console.log('🚀 Starting migration from SQLite to PostgreSQL...\n');

  // Connect to databases
  let sqliteDb;
  let pgPool;

  try {
    sqliteDb = new Database(sqlitePath, { readonly: true });
    console.log('✅ Connected to SQLite database');

    pgPool = new Pool(pgConfig);
    await pgPool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL database\n');

    // Migrate users
    console.log('📦 Migrating users...');
    const users = sqliteDb.prepare('SELECT * FROM users').all();
    for (const user of users) {
      await pgPool.query(
        `INSERT INTO users (id, account_id, full_name, email, password_hash, phone_number,
         phone_last_changed, account_status, twofa_enabled, twofa_method, wallet_balance, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (email) DO NOTHING`,
        [
          user.id,
          user.account_id,
          user.full_name,
          user.email,
          user.password_hash,
          user.phone_number,
          user.phone_last_changed,
          user.account_status,
          user.twofa_enabled === 1,
          user.twofa_method,
          user.wallet_balance || 0,
          user.created_at,
          user.updated_at
        ]
      );
    }
    console.log(`✅ Migrated ${users.length} users\n`);

    // Migrate verification codes
    console.log('📦 Migrating verification codes...');
    const codes = sqliteDb.prepare('SELECT * FROM verification_codes').all();
    for (const code of codes) {
      await pgPool.query(
        `INSERT INTO verification_codes (id, user_id, code, purpose, created_at, expires_at, used)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          code.id,
          code.user_id,
          code.code,
          code.purpose,
          code.created_at,
          code.expires_at,
          code.used === 1
        ]
      );
    }
    console.log(`✅ Migrated ${codes.length} verification codes\n`);

    // Migrate transactions
    console.log('📦 Migrating transactions...');
    const transactions = sqliteDb.prepare('SELECT * FROM transactions').all();
    for (const txn of transactions) {
      await pgPool.query(
        `INSERT INTO transactions (id, user_id, type, amount, status, description,
         stripe_payment_intent_id, recipient_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING`,
        [
          txn.id,
          txn.user_id,
          txn.type,
          txn.amount,
          txn.status,
          txn.description,
          txn.stripe_payment_intent_id,
          txn.recipient_id,
          txn.created_at,
          txn.updated_at
        ]
      );
    }
    console.log(`✅ Migrated ${transactions.length} transactions\n`);

    // Migrate split payments
    console.log('📦 Migrating split payments...');
    const splits = sqliteDb.prepare('SELECT * FROM split_payments').all();
    for (const split of splits) {
      await pgPool.query(
        `INSERT INTO split_payments (id, creator_id, title, description, total_amount,
         num_participants, amount_per_person, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING`,
        [
          split.id,
          split.creator_id,
          split.title,
          split.description,
          split.total_amount,
          split.num_participants,
          split.amount_per_person,
          split.status,
          split.created_at,
          split.updated_at
        ]
      );
    }
    console.log(`✅ Migrated ${splits.length} split payments\n`);

    // Migrate split participants
    console.log('📦 Migrating split participants...');
    const participants = sqliteDb.prepare('SELECT * FROM split_participants').all();
    for (const participant of participants) {
      await pgPool.query(
        `INSERT INTO split_participants (id, split_payment_id, user_id, status, paid,
         joined_at, responded_at, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          participant.id,
          participant.split_payment_id,
          participant.user_id,
          participant.status,
          participant.paid === 1,
          participant.joined_at,
          participant.responded_at,
          participant.paid_at
        ]
      );
    }
    console.log(`✅ Migrated ${participants.length} split participants\n`);

    // Update sequences
    console.log('🔧 Updating PostgreSQL sequences...');
    await pgPool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    await pgPool.query(`SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions))`);
    await pgPool.query(`SELECT setval('split_payments_id_seq', (SELECT MAX(id) FROM split_payments))`);
    console.log('✅ Sequences updated\n');

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (sqliteDb) sqliteDb.close();
    if (pgPool) await pgPool.end();
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migrate;
