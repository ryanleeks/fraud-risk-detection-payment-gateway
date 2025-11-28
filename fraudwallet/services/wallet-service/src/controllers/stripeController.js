const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, validationResult } = require('express-validator');
const database = require('../../../shared/database/postgres');
const ResponseHandler = require('../../../shared/utils/responseHandler');
const Logger = require('../../../shared/utils/logger');

const logger = new Logger('stripe-controller');

const AMOUNT_LIMITS = {
  MIN_TOPUP: 10.00,
  MAX: 999999.99
};

/**
 * Create Stripe Payment Intent
 */
exports.createPaymentIntent = [
  body('amount').isFloat({ min: AMOUNT_LIMITS.MIN_TOPUP }).withMessage(`Minimum top-up is RM${AMOUNT_LIMITS.MIN_TOPUP}`),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseHandler.validationError(res, errors.array());
      }

      const userId = req.user.id;
      const { amount } = req.body;

      // Validate and round amount
      const validatedAmount = Math.round(parseFloat(amount) * 100) / 100;

      if (validatedAmount > AMOUNT_LIMITS.MAX) {
        return ResponseHandler.error(res, `Maximum amount is RM${AMOUNT_LIMITS.MAX}`, 400);
      }

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
      await database.query(
        `INSERT INTO transactions (user_id, type, amount, status, description, stripe_payment_intent_id)
         VALUES ($1, 'add_funds', $2, 'pending', 'Add funds to wallet', $3)`,
        [userId, validatedAmount, paymentIntent.id]
      );

      logger.info('Payment intent created', { userId, amount: validatedAmount, intentId: paymentIntent.id });

      return ResponseHandler.success(res, {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: validatedAmount
      }, 'Payment intent created');

    } catch (error) {
      logger.error('Create payment intent error', error);
      return ResponseHandler.serverError(res, error);
    }
  }
];

/**
 * Handle Stripe Webhook
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  logger.info('Webhook received', { timestamp: new Date().toISOString() });

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    logger.info('Webhook signature verified', { eventType: event.type, eventId: event.id });

  } catch (err) {
    logger.error('Webhook signature verification failed', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object);
        break;

      default:
        logger.info('Unhandled event type', { type: event.type });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    logger.error('Webhook processing error', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(paymentIntent) {
  try {
    const userId = parseInt(paymentIntent.metadata.user_id);
    const amount = paymentIntent.amount / 100; // Convert cents to RM

    logger.info('Processing successful payment', {
      userId,
      amount,
      paymentIntentId: paymentIntent.id
    });

    const client = await database.getClient();

    try {
      await client.query('BEGIN');

      // Update transaction status
      await client.query(
        `UPDATE transactions
         SET status = 'completed', updated_at = NOW()
         WHERE stripe_payment_intent_id = $1`,
        [paymentIntent.id]
      );

      // Add funds to wallet
      await client.query(
        `UPDATE users
         SET wallet_balance = wallet_balance + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [amount, userId]
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (service_name, user_id, action, entity_type, ip_address, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'wallet-service',
          userId,
          'funds_added',
          'transaction',
          'stripe_webhook',
          JSON.stringify({ amount, paymentIntentId: paymentIntent.id })
        ]
      );

      await client.query('COMMIT');

      logger.info('Payment processed successfully', { userId, amount });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Handle payment success error', error);
    throw error;
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(paymentIntent) {
  try {
    logger.info('Processing failed payment', { paymentIntentId: paymentIntent.id });

    // Update transaction status
    await database.query(
      `UPDATE transactions
       SET status = 'failed', updated_at = NOW()
       WHERE stripe_payment_intent_id = $1`,
      [paymentIntent.id]
    );

    logger.info('Payment failure recorded', { paymentIntentId: paymentIntent.id });

  } catch (error) {
    logger.error('Handle payment failure error', error);
    throw error;
  }
}

/**
 * Handle canceled payment
 */
async function handlePaymentCanceled(paymentIntent) {
  try {
    logger.info('Processing canceled payment', { paymentIntentId: paymentIntent.id });

    // Update transaction status
    await database.query(
      `UPDATE transactions
       SET status = 'canceled', updated_at = NOW()
       WHERE stripe_payment_intent_id = $1`,
      [paymentIntent.id]
    );

    logger.info('Payment cancellation recorded', { paymentIntentId: paymentIntent.id });

  } catch (error) {
    logger.error('Handle payment cancellation error', error);
    throw error;
  }
}
