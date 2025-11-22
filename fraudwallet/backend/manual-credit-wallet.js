#!/usr/bin/env node

/**
 * Manual Wallet Credit Script
 * Use this to manually credit a wallet when webhook fails
 */

const db = require('./src/database');

// CONFIGURATION - Update these values from your Stripe Dashboard
const paymentIntentId = 'pi_3SUtErIPUEYccMoX0Odn6Wcq'; // From Stripe Dashboard
const userId = 1; // User ID who made the payment
const amount = 100; // Amount in RM (not cents!)

console.log('========================================');
console.log('Manual Wallet Credit Script');
console.log('========================================');
console.log('Payment Intent ID:', paymentIntentId);
console.log('User ID:', userId);
console.log('Amount: RM', amount);
console.log('========================================\n');

try {
  // Check if transaction exists
  const transaction = db.prepare(`
    SELECT * FROM transactions
    WHERE stripe_payment_intent_id = ?
  `).get(paymentIntentId);

  if (!transaction) {
    console.log('⚠️  Transaction not found in database!');
    console.log('Creating new transaction record...\n');

    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, status, description, stripe_payment_intent_id)
      VALUES (?, 'deposit', ?, 'completed', 'Add funds to wallet (manual)', ?)
    `).run(userId, amount, paymentIntentId);

    console.log('✅ Transaction created');
  } else {
    console.log('📋 Found existing transaction:');
    console.log('   ID:', transaction.id);
    console.log('   Status:', transaction.status);
    console.log('   Amount: RM', transaction.amount);
    console.log('');

    if (transaction.status === 'completed') {
      console.log('⚠️  Transaction already marked as completed!');
      console.log('This payment may have already been processed.');
      console.log('Continuing anyway to verify wallet balance...\n');
    }

    // Update transaction to completed
    db.prepare(`
      UPDATE transactions
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE stripe_payment_intent_id = ?
    `).run(paymentIntentId);

    console.log('✅ Transaction updated to completed');
  }

  // Get current balance
  const userBefore = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(userId);
  console.log('💰 Current balance: RM', userBefore?.wallet_balance || 0);

  // Add funds to wallet
  const walletResult = db.prepare(`
    UPDATE users
    SET wallet_balance = wallet_balance + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, userId);

  if (walletResult.changes === 0) {
    console.log('❌ Failed to update wallet - user not found!');
    process.exit(1);
  }

  // Get new balance
  const userAfter = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(userId);
  console.log('💰 New balance: RM', userAfter.wallet_balance);
  console.log('');
  console.log('========================================');
  console.log('✅ SUCCESS! Wallet credited with RM', amount);
  console.log('========================================');

  // Show recent transactions
  console.log('\n📊 Recent transactions:');
  const recentTxns = db.prepare(`
    SELECT id, type, amount, status, created_at
    FROM transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(userId);

  recentTxns.forEach(txn => {
    console.log(`   ${txn.id}. ${txn.type} - RM${txn.amount} [${txn.status}] - ${txn.created_at}`);
  });

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
  process.exit(1);
}
