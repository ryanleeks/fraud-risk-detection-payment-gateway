# FraudWallet Microservices Setup Guide

This guide will help you set up and run the FraudWallet microservices architecture.

## 🚀 Quick Start (5 Minutes)

### Step 1: Configure Environment Variables

Your `.env` file has been created with defaults. **You MUST update your Stripe keys:**

```bash
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/services

# Edit .env file
nano .env  # or use your preferred editor
```

**Required Changes:**
1. Get your Stripe Secret Key from: https://dashboard.stripe.com/test/apikeys
2. Replace `STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY_HERE` with your actual key
3. Save the file (the webhook secret will be set up in Step 3)

### Step 2: Verify Setup

```bash
./check-setup.sh
```

This will verify your configuration and show any missing values.

### Step 3: Start Services

```bash
# For development (with hot-reload):
docker compose -f docker-compose.dev.yml up --build

# OR for production (stable):
docker compose -f docker-compose.yml up --build
```

**This will start:**
- PostgreSQL (port 5432)
- Redis (port 6379)
- Auth Service (port 3001)
- User Service (port 3002)
- Wallet Service (port 3003)
- SplitPay Service (port 3004)
- Fraud Detection Service (port 3005)
- API Gateway (port 8080)
- Frontend (port 3000)

### Step 4: Set Up Stripe Webhook

**In a NEW terminal:**

```bash
stripe listen --forward-to http://localhost:8080/api/webhook/stripe
```

You'll see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Copy that webhook secret** and update your `.env` file:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

Then restart the wallet service:
```bash
docker compose -f docker-compose.dev.yml restart wallet-service
```

### Step 5: Access the Application

🌐 **Frontend**: http://localhost:3000
🔌 **API Gateway**: http://localhost:8080
📊 **Health Checks**:
- Auth: http://localhost:3001/health
- User: http://localhost:3002/health
- Wallet: http://localhost:3003/health
- SplitPay: http://localhost:3004/health
- Fraud: http://localhost:3005/health

---

## 🛠️ Common Commands

### View Logs
```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Specific service
docker compose -f docker-compose.dev.yml logs -f api-gateway
docker compose -f docker-compose.dev.yml logs -f wallet-service
```

### Restart a Service
```bash
docker compose -f docker-compose.dev.yml restart wallet-service
```

### Stop Everything
```bash
docker compose -f docker-compose.dev.yml down
```

### Rebuild After Code Changes
```bash
docker compose -f docker-compose.dev.yml up --build
```

### Check Running Services
```bash
docker compose -f docker-compose.dev.yml ps
```

---

## 🐛 Troubleshooting

### "Service unhealthy" or "Connection refused"
- Check logs: `docker compose -f docker-compose.dev.yml logs [service-name]`
- Ensure PostgreSQL is running: `docker compose -f docker-compose.dev.yml ps postgres`
- Wait for database to initialize (takes ~10 seconds on first run)

### Stripe Webhook Not Working
1. Verify `STRIPE_WEBHOOK_SECRET` is set in `.env`
2. Restart wallet service after updating: `docker compose -f docker-compose.dev.yml restart wallet-service`
3. Check Stripe CLI is running: `stripe listen --forward-to http://localhost:8080/api/webhook/stripe`

### Frontend Shows "Cannot connect to server"
- Verify API Gateway is running: `curl http://localhost:8080/health`
- Check frontend env: `NEXT_PUBLIC_API_BASE=http://localhost:8080`

### Database Errors
```bash
# Reset database (⚠️ DELETES ALL DATA)
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build
```

---

## 📦 What's Fixed in This Setup

✅ Payment recipient lookup (`/api/payment/lookup-recipient`)
✅ Fraud dashboard top flagged users endpoint
✅ SplitPay undefined errors
✅ SecureTrack JSON parsing errors
✅ All API routing properly configured
✅ Proper error handling for failed API calls

---

## 🔄 Switching Back to Monolithic (If Needed)

If you need to go back to the simple setup:

```bash
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet
docker compose down
docker compose up --build
```

---

## 📝 Environment Variables Reference

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `JWT_SECRET` | Yes | Secret for JWT tokens | Set in .env |
| `STRIPE_SECRET_KEY` | Yes | Stripe API key | **YOU MUST SET** |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook secret | **Set after stripe listen** |
| `DB_HOST` | No | PostgreSQL host | `postgres` |
| `DB_NAME` | No | Database name | `fraudwallet` |
| `DB_USER` | No | Database user | `postgres` |
| `DB_PASSWORD` | No | Database password | `postgres123` |

---

## 🆘 Need Help?

Check the logs for the specific service that's failing:
```bash
docker compose -f docker-compose.dev.yml logs -f [service-name]
```

Common service names: `api-gateway`, `auth-service`, `user-service`, `wallet-service`, `splitpay-service`, `fraud-detection-service`, `postgres`, `frontend`
