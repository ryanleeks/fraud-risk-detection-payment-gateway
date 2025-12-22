/**
 * Diagnostic script to check and manually release held money
 * Run this with: node debug-release-money.js <transactionId>
 */

const db = require('./src/database');
const wallet = require('./src/wallet');

const transactionId = process.argv[2];

if (!transactionId) {
  console.error('Usage: node debug-release-money.js <transactionId>');
  console.log('\nExample: node debug-release-money.js 129');
  process.exit(1);
}

async function debugAndRelease() {
  console.log(`\n🔍 Debugging Transaction #${transactionId}\n`);

  // Step 1: Check if transaction exists
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);

  if (!transaction) {
    console.log('❌ Transaction not found!');
    return;
  }

  console.log('✅ Transaction found:');
  console.log('   Amount:', transaction.amount);
  console.log('   Type:', transaction.type);
  console.log('   Status:', transaction.status);
  console.log('   Money Status:', transaction.money_status);
  console.log('   Fraud Log ID:', transaction.fraud_log_id);
  console.log('   Recipient ID:', transaction.recipient_id);

  // Step 2: Check if appeal exists
  if (transaction.fraud_log_id) {
    const appeal = db.prepare('SELECT * FROM fraud_appeals WHERE fraud_log_id = ?').get(transaction.fraud_log_id);

    if (appeal) {
      console.log('\n✅ Appeal found:');
      console.log('   Appeal ID:', appeal.id);
      console.log('   Status:', appeal.status);
      console.log('   Submitted at:', appeal.created_at);
      console.log('   Resolved at:', appeal.resolved_at);
    } else {
      console.log('\n❌ No appeal found for this transaction');
    }
  } else {
    console.log('\n❌ No fraud_log_id - cannot find appeal');
  }

  // Step 3: Check recipient user
  if (transaction.recipient_id) {
    const recipient = db.prepare('SELECT id, full_name, wallet_balance FROM users WHERE id = ?').get(transaction.recipient_id);
    console.log('\n✅ Recipient:');
    console.log('   Name:', recipient.full_name);
    console.log('   Balance:', recipient.wallet_balance);
  }

  // Step 4: Try to release money
  if (transaction.money_status === 'held') {
    console.log('\n💰 Attempting to release money...');

    try {
      const result = await wallet.releaseMoney(
        parseInt(transactionId),
        1, // Admin user ID
        'Manual release via debug script'
      );

      console.log('✅ SUCCESS! Money released:');
      console.log('   Transaction ID:', result.transactionId);
      console.log('   Amount:', result.amount);
      console.log('   Recipient ID:', result.recipientId);

      // Verify the update
      const updatedTransaction = db.prepare('SELECT money_status, resolution_action FROM transactions WHERE id = ?').get(transactionId);
      console.log('\n✅ Verification:');
      console.log('   Money Status:', updatedTransaction.money_status);
      console.log('   Resolution:', updatedTransaction.resolution_action);

    } catch (error) {
      console.error('\n❌ ERROR releasing money:');
      console.error('   ', error.message);
      console.error('\nFull error:', error);
    }
  } else {
    console.log(`\n⚠️  Transaction is not held (status: ${transaction.money_status})`);
    console.log('   Cannot release money that is not held.');
  }
}

debugAndRelease().then(() => {
  console.log('\n✅ Debug complete\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
