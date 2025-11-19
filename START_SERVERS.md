# How to Start the FraudWallet Application

## Step-by-Step Startup Guide

### Step 1: Start Backend Server

Open a terminal and run:

```bash
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/backend
npm start
```

You should see:
```
✅ Server is running on http://localhost:8080
📡 Ready to accept requests
```

**Keep this terminal open!** The backend must stay running.

---

### Step 2: Start Stripe Webhook Forwarding

Open a **NEW terminal** (keep the backend running) and run:

```bash
stripe listen --forward-to http://localhost:8080/api/webhook/stripe
```

You should see:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**IMPORTANT:** Copy that `whsec_...` secret!

Then:
1. Open `/home/user/fraud-risk-detection-payment-gateway/fraudwallet/backend/.env`
2. Update this line:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```
3. Save the file
4. Go back to the backend terminal and restart it (Ctrl+C then `npm start`)

**Keep this terminal open too!** The Stripe CLI must keep running to forward webhooks.

---

### Step 3: Start Frontend Server

Open a **THIRD terminal** and run:

```bash
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/frontend
npm run dev
```

You should see:
```
- Local:        http://localhost:3000
```

---

### Step 4: Verify Everything is Running

You should now have **3 terminals open**:

✅ **Terminal 1**: Backend server on port 8080
✅ **Terminal 2**: Stripe CLI forwarding webhooks
✅ **Terminal 3**: Frontend server on port 3000

---

### Step 5: Test the Setup

Run this test:

```bash
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/backend
node test-webhook-endpoint.js
```

You should see:
```
✅ Backend is running!
✅ Webhook endpoint is accessible!
✅ Backend is properly configured!
```

---

### Step 6: Make a Test Payment

1. Open browser: http://localhost:3000
2. Login to your account
3. Click "Add Funds"
4. Enter amount: 100
5. Click "Continue to Payment"
6. Enter test card: `4242 4242 4242 4242`
7. Expiry: `12/34`, CVC: `123`
8. Click "Pay RM 100"

---

### Step 7: Watch the Logs

After clicking "Pay", you should see in your **3 terminals**:

**Terminal 1 (Backend):**
```
📥 Webhook received at: 2025-11-19T...
✅ Webhook signature verified
📨 Event type: payment_intent.succeeded
💳 Payment Intent ID: pi_...
✅ Payment successful: User 1 added RM100 to wallet
```

**Terminal 2 (Stripe CLI):**
```
2025-11-19 ... --> payment_intent.succeeded [evt_...]
2025-11-19 ... <-- [200] POST http://localhost:8080/api/webhook/stripe [evt_...]
```

**Terminal 3 (Frontend):**
Nothing special, just normal Next.js logs

---

## Common Issues

### Issue 1: Backend not starting

**Error:** `Error: listen EADDRINUSE: address already in use :::8080`

**Solution:**
```bash
# Kill process using port 8080
lsof -ti:8080 | xargs kill -9
# Then restart
npm start
```

### Issue 2: Stripe CLI not installed

**Error:** `stripe: command not found`

**Solution:**
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.4/stripe_1.19.4_linux_x86_64.tar.gz
tar -xvf stripe_1.19.4_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

### Issue 3: Stripe CLI not logged in

**Error:** `You need to login first`

**Solution:**
```bash
stripe login
# Follow the browser prompts to authorize
```

### Issue 4: Webhook secret not configured

**Symptom:** Backend shows "Webhook secret configured: No ❌"

**Solution:**
1. Check Terminal 2 (Stripe CLI) for the `whsec_...` secret
2. Update `.env` file
3. Restart backend (Ctrl+C then `npm start`)

---

## Quick Start Command (All in One)

If you want to start everything at once, you can use `screen` or `tmux`:

```bash
# Install tmux if not installed
sudo apt-get install tmux  # Linux
brew install tmux          # macOS

# Start all servers in tmux
cd /home/user/fraud-risk-detection-payment-gateway
tmux new-session -d -s fraudwallet
tmux send-keys -t fraudwallet "cd fraudwallet/backend && npm start" C-m
tmux split-window -h -t fraudwallet
tmux send-keys -t fraudwallet "stripe listen --forward-to http://localhost:8080/api/webhook/stripe" C-m
tmux split-window -v -t fraudwallet
tmux send-keys -t fraudwallet "cd fraudwallet/frontend && npm run dev" C-m
tmux attach -t fraudwallet

# To exit: Ctrl+B then D (detach)
# To kill: tmux kill-session -t fraudwallet
```

---

## Summary

**You need 3 processes running simultaneously:**

1. **Backend** - Handles API requests and webhooks
2. **Stripe CLI** - Forwards webhooks from Stripe to localhost
3. **Frontend** - Serves the web application

All three must be running for payments to work correctly!
