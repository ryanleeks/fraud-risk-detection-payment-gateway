/**
 * Fix admin review and release money
 * Run this with: node fix-admin-review.js <transactionId>
 */

const db = require('./src/database');
const wallet = require('./src/wallet');

const transactionId = process.argv[2];

if (!transactionId) {
  console.error('Usage: node fix-admin-review.js <transactionId>');
  console.log('\nExample: node fix-admin-review.js 140');
  process.exit(1);
}

async function fixAdminReview() {
  console.log(`\n🔍 Checking Transaction #${transactionId}\n`);

  // Get transaction
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);

  if (!transaction) {
    console.log('❌ Transaction not found!');
    return;
  }

  console.log('✅ Transaction found:');
  console.log('   User ID:', transaction.user_id);
  console.log('   Amount:', transaction.amount);
  console.log('   Money Status:', transaction.money_status);
  console.log('   Fraud Log ID:', transaction.fraud_log_id);

  // Find fraud log for this user and amount
  const fraudLog = db.prepare(`
    SELECT * FROM fraud_logs
    WHERE user_id = ? AND amount = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(transaction.user_id, transaction.amount);

  if (!fraudLog) {
    console.log('\n❌ No fraud log found for this transaction!');
    console.log('   This transaction might not have triggered fraud detection.');
    return;
  }

  console.log('\n✅ Fraud log found:');
  console.log('   Fraud Log ID:', fraudLog.id);
  console.log('   Risk Score:', fraudLog.risk_score);
  console.log('   Admin Review Status:', fraudLog.admin_review_status);
  console.log('   Ground Truth:', fraudLog.ground_truth);

  // Link transaction to fraud log if not linked
  if (!transaction.fraud_log_id) {
    console.log('\n🔗 Linking transaction to fraud log...');
    db.prepare('UPDATE transactions SET fraud_log_id = ? WHERE id = ?').run(fraudLog.id, transactionId);
    console.log('✅ Linked!');
  }

  // Check if admin marked as legitimate
  if (fraudLog.admin_review_status === 'legitimate' || fraudLog.ground_truth === 'legitimate') {
    console.log('\n💰 Admin marked as LEGITIMATE - Releasing money...');

    try {
      const result = await wallet.releaseMoney(
        parseInt(transactionId),
        fraudLog.admin_reviewed_by || 1,
        'Admin marked as legitimate (manual fix)'
      );

      console.log('✅ SUCCESS! Money released:');
      console.log('   Amount:', result.amount);
      console.log('   Recipient ID:', result.recipientId);

      // Verify
      const updated = db.prepare('SELECT money_status FROM transactions WHERE id = ?').get(transactionId);
      console.log('   New Status:', updated.money_status);

    } catch (error) {
      console.error('\n❌ ERROR releasing money:');
      console.error('   ', error.message);
    }
  } else {
    console.log('\n⚠️  Admin has NOT marked this as legitimate yet.');
    console.log('   Admin Review Status:', fraudLog.admin_review_status);
    console.log('   Ground Truth:', fraudLog.ground_truth);
  }
}

fixAdminReview().then(() => {
  console.log('\n✅ Done\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
