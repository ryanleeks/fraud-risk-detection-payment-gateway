// Wallet and Stripe payment management
const db = require('./database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount'
      });
    }

    // Stripe requires amount in cents
    const amountInCents = Math.round(amount * 100);

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
    `).run(userId, amount, paymentIntent.id);

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

    console.log(`✅ Created payment intent for user ${userId}: RM${amount}`);

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

module.exports = {
  getWalletBalance,
  createPaymentIntent,
  handleStripeWebhook,
  getTransactionHistory
};
