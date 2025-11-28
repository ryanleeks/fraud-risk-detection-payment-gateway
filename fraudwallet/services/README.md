# FraudWallet Microservices Architecture

🏗️ **Containerized Microservices for Fraud Detection Payment Gateway**

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Microservices](#microservices)
- [Quick Start](#quick-start)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Monitoring & Logging](#monitoring--logging)

---

## 🏛️ Architecture Overview

FraudWallet uses a microservices architecture with 6 independent services:

```
┌─────────────┐
│   Frontend  │ (Next.js on port 3000)
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ API Gateway │ (Port 8080)
└──────┬──────┘
       │
       ├─────→ Auth Service (Port 3001)
       ├─────→ User Service (Port 3002)
       ├─────→ Wallet Service (Port 3003)
       ├─────→ SplitPay Service (Port 3004)
       └─────→ Fraud Detection Service (Port 3005)

┌──────────────────────────────────┐
│  PostgreSQL (Port 5432)          │
│  Redis (Port 6379)               │
└──────────────────────────────────┘
```

### Benefits of This Architecture

✅ **Scalability** - Scale individual services independently based on load
✅ **Resilience** - Service failures don't crash the entire system
✅ **Maintainability** - Smaller, focused codebases per service
✅ **Independent Deployment** - Deploy services without affecting others
✅ **Technology Flexibility** - Use different tech stacks per service if needed

---

## 🔧 Microservices

### 1. **Auth Service** (Port 3001)

**Responsibility:** Authentication, 2FA, JWT token management

**Endpoints:**
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-2fa` - Verify 2FA code
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/logout` - Logout

**Tech Stack:** Node.js, Express, bcrypt, jsonwebtoken, nodemailer

---

### 2. **User Service** (Port 3002)

**Responsibility:** User profile management, account IDs, 2FA settings

**Endpoints:**
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `PUT /api/user/phone` - Change phone number
- `POST /api/user/2fa/toggle` - Enable/disable 2FA
- `POST /api/user/lookup-recipient` - Find user for payments
- `GET /api/user/qrcode` - Generate QR code for payments

**Tech Stack:** Node.js, Express, QRCode

---

### 3. **Wallet Service** (Port 3003)

**Responsibility:** Wallet operations, Stripe payments, transactions

**Endpoints:**
- `GET /api/wallet/balance` - Get wallet balance
- `POST /api/wallet/add-funds` - Create Stripe payment intent
- `GET /api/wallet/transactions` - Transaction history
- `POST /api/wallet/send` - Send money to another user
- `POST /api/webhook/stripe` - Stripe webhook handler

**Tech Stack:** Node.js, Express, Stripe SDK

**Integration:** Calls Fraud Detection Service for transaction risk assessment

---

### 4. **SplitPay Service** (Port 3004)

**Responsibility:** Bill splitting logic, group payments

**Endpoints:**
- `POST /api/splitpay/create` - Create split payment
- `GET /api/splitpay/my-splits` - Get user's split payments
- `POST /api/splitpay/respond` - Accept/reject split
- `POST /api/splitpay/pay` - Pay your share
- `POST /api/splitpay/cancel` - Cancel split payment

**Tech Stack:** Node.js, Express, Axios

**Integration:** Calls Wallet Service for fund transfers

---

### 5. **Fraud Detection Service** (Port 3005)

**Responsibility:** Real-time fraud analysis, risk scoring, monitoring

**Endpoints:**
- `POST /api/fraud/check-transaction` - Analyze transaction risk
- `GET /api/fraud/user-stats` - User fraud statistics
- `GET /api/fraud/system-metrics` - System-wide metrics
- `GET /api/fraud/recent-logs` - Recent fraud logs
- `GET /api/fraud/high-risk-users` - High-risk user list

**Tech Stack:** Node.js, Express

**Features:**
- Velocity checks (transaction frequency)
- Amount anomaly detection
- Behavioral analysis
- Risk score calculation (0-100)
- Automatic blocking for high-risk transactions (score > 80)

---

### 6. **API Gateway** (Port 8080)

**Responsibility:** Single entry point, routing, rate limiting, CORS

**Features:**
- Request routing to appropriate microservices
- Rate limiting (100 requests per 15 minutes)
- Security headers (Helmet.js)
- CORS configuration
- Health check aggregation

**Tech Stack:** Node.js, Express, http-proxy-middleware

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose installed
- Node.js 20+ (for local development)
- PostgreSQL 15+ (or use Docker)

### Option 1: Docker Compose (Recommended)

```bash
# Navigate to services directory
cd fraudwallet/services

# Copy environment variables
cp .env.example .env
# Edit .env with your Stripe keys and other secrets

# Start all services in development mode
docker-compose -f docker-compose.dev.yml up

# Or start in production mode
docker-compose up
```

**Access the application:**
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8080
- Services: http://localhost:3001-3005

### Option 2: Manual Setup

```bash
# 1. Start PostgreSQL
# Create database 'fraudwallet' and run schema.sql

# 2. Start each service
cd services/auth-service && npm install && npm start
cd services/user-service && npm install && npm start
cd services/wallet-service && npm install && npm start
cd services/splitpay-service && npm install && npm start
cd services/fraud-detection-service && npm install && npm start
cd services/api-gateway && npm install && npm start

# 3. Start frontend
cd fraudwallet/frontend && npm install && npm run dev
```

---

## 💻 Development

### Hot Reload Development

```bash
# Use development docker-compose for hot-reload
cd fraudwallet/services
docker-compose -f docker-compose.dev.yml up
```

All services will automatically restart when you modify code files.

### Debugging Individual Services

```bash
# Debug auth service
cd services/auth-service
npm run dev

# Check logs
docker-compose logs -f auth-service
```

### Database Migrations

```bash
# Migrate from SQLite to PostgreSQL
cd services/shared
npm install
npm run migrate
```

### Running Tests

```bash
# Test specific service
cd services/wallet-service
npm test

# Test all services
cd services
./run-tests.sh
```

---

## 🌐 Production Deployment

### Docker Compose Production

```bash
# Build and start
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### AWS Deployment

The architecture is designed for AWS ECS/EKS:

1. **Build images:**
   ```bash
   docker build -t fraudwallet-auth:latest -f services/auth-service/Dockerfile .
   docker build -t fraudwallet-user:latest -f services/user-service/Dockerfile .
   # ... build all services
   ```

2. **Push to ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
   docker tag fraudwallet-auth:latest <account>.dkr.ecr.us-east-1.amazonaws.com/fraudwallet-auth:latest
   docker push <account>.dkr.ecr.us-east-1.amazonaws.com/fraudwallet-auth:latest
   ```

3. **Deploy to ECS/EKS:**
   - Use task definitions for each service
   - Configure service discovery
   - Set up Application Load Balancer
   - Configure Auto Scaling

### Environment Variables for Production

```bash
# REQUIRED
JWT_SECRET=<strong-random-string>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OPTIONAL
DB_HOST=production-db.amazonaws.com
DB_PASSWORD=<secure-password>
SMTP_USER=production@fraudwallet.com
```

---

## 📚 API Documentation

### Authentication Flow

```
1. User → POST /api/auth/signup
2. Auth Service → Create user & generate JWT
3. Auth Service → Return { user, token }

4. User → POST /api/auth/login (with 2FA enabled)
5. Auth Service → Send 2FA code via email
6. User → POST /api/auth/verify-2fa
7. Auth Service → Return { user, token }
```

### Payment Flow

```
1. User → POST /api/wallet/send { recipientId, amount }
2. API Gateway → Route to Wallet Service
3. Wallet Service → Call Fraud Detection Service
4. Fraud Service → Return risk score
5. Wallet Service → Process or block transaction
6. Wallet Service → Update balances (if allowed)
7. Wallet Service → Return success/failure
```

### Full API Reference

See [API_REFERENCE.md](./API_REFERENCE.md) for complete endpoint documentation.

---

## 🗄️ Database Schema

**PostgreSQL Database: `fraudwallet`**

### Main Tables

- **users** - User accounts, authentication, wallet balance
- **transactions** - All wallet transactions with fraud scores
- **verification_codes** - 2FA and verification codes
- **split_payments** - Bill splitting requests
- **split_participants** - Participants in split payments
- **fraud_logs** - Fraud detection logs
- **user_risk_profiles** - Aggregated user risk metrics
- **audit_logs** - System-wide audit trail

**Schema:** See `services/shared/database/schema.sql`

---

## 📊 Monitoring & Logging

### Health Checks

Each service exposes `/health` endpoint:

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
curl http://localhost:8080/health
```

### Centralized Logging

All services use structured JSON logging:

```json
{
  "timestamp": "2025-11-28T10:30:00.000Z",
  "service": "wallet-service",
  "level": "INFO",
  "message": "Transaction processed",
  "userId": 123,
  "amount": 100.00,
  "fraudScore": 15.5
}
```

### Viewing Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f wallet-service

# Follow logs with grep
docker-compose logs -f | grep ERROR
```

---

## 🔒 Security Considerations

- ✅ JWT authentication on all protected routes
- ✅ Rate limiting on API Gateway
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configuration
- ✅ Helmet.js security headers
- ✅ Stripe webhook signature verification
- ✅ Fraud detection on all transactions
- ✅ 2FA support

---

## 📞 Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Verify all services are healthy
3. Check environment variables
4. Review API documentation

---

## 📝 License

Copyright © 2025 Ryan Lee Khang Sern. All rights reserved.

For licensing or attribution inquiries, please contact: @gmail.com
