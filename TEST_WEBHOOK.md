# Debugging Webhook Issue - Payment Succeeded but Database Not Updated

## Current Problem

✅ Stripe Dashboard shows payment succeeded
❌ Wallet balance not updated in app
❌ Database not updated

## Root Cause

The **webhook is not being triggered or received**. Here's why:

1. **Backend must be running** to receive webhooks
2. **Stripe can't reach localhost** - webhooks need a public URL or Stripe CLI
3. **Webhook secret must match** between Stripe and your `.env` file

## Solution: Set Up Stripe Webhook Forwarding

### Option A: Use Stripe CLI (Recommended for Local Development)

#### Step 1: Install Stripe CLI

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
# Download latest release
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.4/stripe_1.19.4_linux_x86_64.tar.gz
tar -xvf stripe_1.19.4_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Windows:**
Download from: https://github.com/stripe/stripe-cli/releases

#### Step 2: Login to Stripe CLI
```bash
stripe login
# This will open a browser window to authorize
```

#### Step 3: Forward Webhooks to Your Local Backend
```bash
# Start webhook forwarding
stripe listen --forward-to http://localhost:8080/api/webhook/stripe
```

**IMPORTANT:** This command will output a **webhook signing secret** like:
```
> Ready! Your webhook signing secret is whsec_1234567890abcdefghijklmnop
```

#### Step 4: Copy the Webhook Secret

Copy that `whsec_...` value and update your backend `.env`:

```bash
# Edit: /home/user/fraud-risk-detection-payment-gateway/fraudwallet/backend/.env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnop
```

#### Step 5: Restart Your Backend Server

```bash
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/backend
npm start
```

Now when you make a payment, the Stripe CLI will forward the webhook to your local server!

---

### Option B: Manual Webhook Testing (Quick Test)

If you can't use Stripe CLI right now, you can manually trigger the webhook handler:

#### Create a test script:

```bash
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/backend
```

Create `test-webhook.js`:

```javascript
const db = require('./src/database');

// Get the payment intent ID from Stripe dashboard
const paymentIntentId = 'pi_3SUtErIPUEYccMoX0Odn6Wcq'; // Replace with your actual ID
const userId = 1; // Your user ID
const amount = 100; // Amount in RM

console.log('Manually updating database...');

try {
  // Update transaction status
  const txnResult = db.prepare(`
    UPDATE transactions
    SET status = 'completed', updated_at = CURRENT_TIMESTAMP
    WHERE stripe_payment_intent_id = ?
  `).run(paymentIntentId);

  console.log('✅ Updated transaction:', txnResult.changes, 'rows');

  // Add funds to wallet
  const walletResult = db.prepare(`
    UPDATE users
    SET wallet_balance = wallet_balance + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, userId);

  console.log('✅ Updated wallet balance:', walletResult.changes, 'rows');

  // Verify
  const user = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(userId);
  console.log('✅ New wallet balance: RM', user.wallet_balance);

} catch (error) {
  console.error('❌ Error:', error);
}
```

Run it:
```bash
node test-webhook.js
```

This will manually update the database. **But this is only for testing** - you still need to fix webhooks for production!

---

## Checking if Backend is Running

```bash
# Check if backend server is running on port 8080
curl http://localhost:8080/api/health

# Should return:
# {"status":"healthy","timestamp":"..."}
```

If you get "Connection refused", start the backend:
```bash
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/backend
npm start
```

---

## Verifying Webhook Logs

Once webhooks are working, you should see these logs in your backend:

**Success:**
```
✅ Payment successful: User 1 added RM100 to wallet
```

**Failure:**
```
❌ Webhook signature verification failed: ...
```

---

## Quick Troubleshooting Checklist

- [ ] Backend server is running (`npm start`)
- [ ] Backend shows "Server is running on http://localhost:8080"
- [ ] Stripe CLI is installed and logged in
- [ ] Stripe CLI is forwarding webhooks (`stripe listen --forward-to...`)
- [ ] Webhook secret in `.env` matches the one from Stripe CLI
- [ ] Backend was restarted after updating `.env`
- [ ] Payment was made AFTER setting up webhook forwarding

---

## Expected Flow

1. User clicks "Add Funds" and enters card details
2. Payment succeeds in Stripe ✅
3. Stripe sends webhook to your URL
4. **Stripe CLI forwards webhook to localhost:8080** ← This is what's missing!
5. Backend receives webhook and verifies signature
6. Backend updates transaction status to "completed"
7. Backend adds funds to user's wallet
8. Frontend refreshes and shows new balance

---

## Alternative: Test with Stripe Dashboard Webhook

For testing only, you can send test webhooks from Stripe Dashboard:

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click your webhook endpoint
3. Click "Send test webhook"
4. Select event: `payment_intent.succeeded`
5. Click "Send test webhook"

But this won't work for localhost without Stripe CLI forwarding!

---

## Need Help?

If you're still stuck, provide:
1. Backend server logs (what do you see when you run `npm start`?)
2. Is Stripe CLI running? (`stripe listen` output)
3. Payment Intent ID from Stripe Dashboard
