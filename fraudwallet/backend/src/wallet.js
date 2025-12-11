// Wallet and Stripe payment management
const db = require('./database');

// Initialize Stripe with error handling
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_51PlaceholderKeyForDevelopmentPurposesOnly123456789') {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized');
  } else {
    console.warn('⚠️  Stripe API key not configured - payment features will be disabled');
  }
} catch (error) {
  console.error('❌ Stripe initialization failed:', error.message);
}

const fraudDetection = require('./fraud-detection');

// Amount validation constants
const AMOUNT_LIMITS = {
  MIN: 0.01,
  MAX: 999999.99,
  MIN_TOPUP: 10.00
};

/**
 * Validate and round amount to 2 decimal places
 */
const validateAmount = (amount, options = {}) => {
  // Convert to number and round to 2 decimal places
  const numAmount = Math.round(parseFloat(amount) * 100) / 100;

  if (isNaN(numAmount)) {
    return { isValid: false, error: 'Invalid amount format' };
  }

  if (numAmount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }

  if (options.minTopup && numAmount < AMOUNT_LIMITS.MIN_TOPUP) {
    return { isValid: false, error: `Minimum top-up amount is RM ${AMOUNT_LIMITS.MIN_TOPUP.toFixed(2)}` };
  }

  if (numAmount > AMOUNT_LIMITS.MAX) {
    return { isValid: false, error: `Maximum amount is RM ${AMOUNT_LIMITS.MAX.toFixed(2)}` };
  }

  return { isValid: true, value: numAmount };
};

/**
 * GET WALLET BALANCE
 * Get user's current wallet balance
 */
const getWalletBalance = (req, res) => {
  try {
    const userId = req.user.userId;

    const user = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      balance: user.wallet_balance || 0.00
    });

  } catch (error) {
    console.error('❌ Get wallet balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet balance'
    });
  }
};

/**
 * CREATE PAYMENT INTENT
 * Create Stripe payment intent for adding funds
 */
const createPaymentIntent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    // Validate amount
    const validation = validateAmount(amount, { minTopup: true });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    // Use validated amount (already rounded to 2 decimals)
    const validatedAmount = validation.value;

    // Stripe requires amount in cents
    const amountInCents = Math.round(validatedAmount * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'myr',  // Malaysian Ringgit
      metadata: {
        user_id: userId,
        type: 'add_funds'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Record pending transaction
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, status, description, stripe_payment_intent_id)
      VALUES (?, 'deposit', ?, 'pending', 'Add funds to wallet', ?)
    `).run(userId, validatedAmount, paymentIntent.id);

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

    console.log(`✅ Created payment intent for user ${userId}: RM${validatedAmount.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment intent'
    });
  }
};

/**
 * STRIPE WEBHOOK
 * Handle Stripe webhook events
 */
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('📥 Webhook received at:', new Date().toISOString());
  console.log('Webhook secret configured:', webhookSecret ? 'Yes (' + webhookSecret.substring(0, 10) + '...)' : 'No ❌');

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log('✅ Webhook signature verified');
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('📨 Event type:', event.type);
  console.log('Event ID:', event.id);

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('💳 Payment Intent ID:', paymentIntent.id);
      console.log('💰 Amount:', paymentIntent.amount / 100, paymentIntent.currency.toUpperCase());
      console.log('👤 User ID from metadata:', paymentIntent.metadata.user_id);
      await handlePaymentSuccess(paymentIntent);
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('❌ Payment failed:', failedPayment.id);
      await handlePaymentFailure(failedPayment);
      break;

    default:
      console.log(`ℹ️  Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
};

/**
 * Handle successful payment
 */
const handlePaymentSuccess = async (paymentIntent) => {
  try {
    const userId = parseInt(paymentIntent.metadata.user_id);
    const amount = paymentIntent.amount / 100; // Convert cents to dollars

    // Update transaction status
    db.prepare(`
      UPDATE transactions
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE stripe_payment_intent_id = ?
    `).run(paymentIntent.id);

    // Add funds to wallet
    db.prepare(`
      UPDATE users
      SET wallet_balance = wallet_balance + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(amount, userId);

    console.log(`✅ Payment successful: User ${userId} added RM${amount} to wallet`);

  } catch (error) {
    console.error('❌ Handle payment success error:', error);
  }
};

/**
 * Handle failed payment
 */
const handlePaymentFailure = async (paymentIntent) => {
  try {
    // Update transaction status
    db.prepare(`
      UPDATE transactions
      SET status = 'failed', updated_at = CURRENT_TIMESTAMP
      WHERE stripe_payment_intent_id = ?
    `).run(paymentIntent.id);

    console.log(`❌ Payment failed: ${paymentIntent.id}`);

  } catch (error) {
    console.error('❌ Handle payment failure error:', error);
  }
};

/**
 * GET TRANSACTION HISTORY
 * Get user's transaction history
 */
const getTransactionHistory = (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    const transactions = db.prepare(`
      SELECT
        t.id,
        t.type,
        t.amount,
        t.status,
        t.description,
        t.created_at,
        u.full_name as recipient_name,
        u.account_id as recipient_account_id
      FROM transactions t
      LEFT JOIN users u ON t.recipient_id = u.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, parseInt(limit), parseInt(offset));

    res.status(200).json({
      success: true,
      transactions
    });

  } catch (error) {
    console.error('❌ Get transaction history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction history'
    });
  }
};

/**
 * SEND MONEY TO ANOTHER USER
 * Transfer funds from one user to another
 */
const sendMoney = async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { recipientId, amount, note } = req.body;

    // Validate recipient
    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient is required'
      });
    }

    // Validate amount
    const validation = validateAmount(amount);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    // Use validated amount (already rounded to 2 decimals)
    const validatedAmount = validation.value;

    if (senderId === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send money to yourself'
      });
    }

    // Check sender exists and has sufficient balance
    const sender = db.prepare('SELECT id, wallet_balance, full_name, created_at FROM users WHERE id = ?').get(senderId);
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: 'Sender not found'
      });
    }

    if (sender.wallet_balance < validatedAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // 🔒 FRAUD DETECTION CHECK
    const fraudCheck = await fraudDetection.analyzeFraudRisk({
      userId: senderId,
      amount: validatedAmount,
      type: 'transfer_sent',
      recipientId: recipientId
    }, {
      walletBalance: sender.wallet_balance,
      accountCreated: sender.created_at
    });

    // Log fraud check result
    console.log(`🔍 Fraud Check - User ${senderId}: Score ${fraudCheck.riskScore}/100 (${fraudCheck.riskLevel}) - Action: ${fraudCheck.action}`);

    // Handle fraud detection result
    if (fraudCheck.action === 'BLOCK') {
      return res.status(403).json({
        success: false,
        message: 'Transaction blocked due to fraud risk',
        fraudDetection: {
          riskScore: fraudCheck.riskScore,
          riskLevel: fraudCheck.riskLevel,
          reason: fraudCheck.aiAnalysis?.reasoning || 'Multiple fraud indicators detected',
          detectionMethod: fraudCheck.detectionMethod,
          triggeredRules: fraudCheck.triggeredRules.map(r => ({
            name: r.ruleName,
            description: r.description
          })),
          aiInsights: fraudCheck.aiAnalysis ? {
            score: fraudCheck.aiAnalysis.riskScore,
            confidence: fraudCheck.aiAnalysis.confidence,
            redFlags: fraudCheck.aiAnalysis.redFlags
          } : null
        }
      });
    }

    if (fraudCheck.action === 'REVIEW') {
      // Flag for manual review but allow transaction
      console.log(`⚠️  HIGH RISK TRANSACTION - Flagged for review: User ${senderId}, Amount: RM${validatedAmount.toFixed(2)}`);
    }

    // Check recipient exists
    const recipient = db.prepare('SELECT id, full_name, account_id FROM users WHERE id = ?').get(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Perform transfer in a transaction for atomicity
    const transfer = db.transaction(() => {
      // Deduct from sender
      db.prepare(`
        UPDATE users
        SET wallet_balance = wallet_balance - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(validatedAmount, senderId);

      // Add to recipient
      db.prepare(`
        UPDATE users
        SET wallet_balance = wallet_balance + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(validatedAmount, recipientId);

      // Create transaction record for sender
      const description = note || `Transfer to ${recipient.full_name}`;
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, status, description, recipient_id)
        VALUES (?, 'transfer_sent', ?, 'completed', ?, ?)
      `).run(senderId, validatedAmount, description, recipientId);

      // Create transaction record for recipient
      const recipientDescription = note || `Transfer from ${sender.full_name}`;
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, status, description, recipient_id)
        VALUES (?, 'transfer_received', ?, 'completed', ?, ?)
      `).run(recipientId, validatedAmount, recipientDescription, senderId);
    });

    // Execute the transaction
    transfer();

    console.log(`✅ Transfer successful: User ${senderId} sent RM${validatedAmount.toFixed(2)} to User ${recipientId}`);

    res.status(200).json({
      success: true,
      message: 'Transfer successful',
      transfer: {
        amount: validatedAmount,
        recipient: {
          name: recipient.full_name,
          accountId: recipient.account_id
        }
      }
    });

  } catch (error) {
    console.error('❌ Send money error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing transfer'
    });
  }
};

module.exports = {
  getWalletBalance,
  createPaymentIntent,
  handleStripeWebhook,
  getTransactionHistory,
  sendMoney
};
