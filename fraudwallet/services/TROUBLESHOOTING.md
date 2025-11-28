# FraudWallet Services - Troubleshooting & Setup Guide

## Problem: Services Not Starting

If you're having issues with services on ports 3001-3005, follow this guide:

---

## Prerequisites Check

### 1. Docker Installation

**Check if Docker is installed:**
```bash
docker --version
docker-compose --version
# OR (newer Docker versions)
docker compose version
```

**If not installed:**

- **macOS:** Download [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Windows:** Download [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux:**
  ```bash
  # Ubuntu/Debian
  sudo apt-get update
  sudo apt-get install docker.io docker-compose

  # Start Docker
  sudo systemctl start docker
  sudo systemctl enable docker
  ```

### 2. PostgreSQL Installation (If not using Docker)

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-15
sudo systemctl start postgresql
```

**Windows:**
Download from [PostgreSQL.org](https://www.postgresql.org/download/windows/)

---

## Option 1: Run with Docker (Recommended)

### Step 1: Verify Docker is Running

```bash
docker ps
# Should show running containers or empty list (not an error)
```

### Step 2: Navigate to Services Directory

```bash
cd /path/to/fraud-risk-detection-payment-gateway/fraudwallet/services
```

### Step 3: Create Environment File

```bash
cp .env.example .env

# Edit .env with your values
nano .env  # or use your preferred editor
```

Required variables:
```env
JWT_SECRET=your-super-secret-jwt-key-change-this
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Step 4: Start Services

**Modern Docker (recommended):**
```bash
docker compose -f docker-compose.dev.yml up
```

**Older Docker Compose:**
```bash
docker-compose -f docker-compose.dev.yml up
```

**Build and start fresh:**
```bash
docker compose -f docker-compose.dev.yml up --build
```

**Run in background:**
```bash
docker compose -f docker-compose.dev.yml up -d
```

### Step 5: Verify Services

```bash
# Check running containers
docker compose ps

# Check logs
docker compose logs -f

# Check specific service
docker compose logs -f auth-service

# Test health endpoints
curl http://localhost:8080/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
```

---

## Option 2: Run Manually (Without Docker)

If Docker is not available, run services manually:

### Step 1: Install PostgreSQL

Create database:
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE fraudwallet;
\c fraudwallet

# Run schema
\i /path/to/services/shared/database/schema.sql

# Run seed data (optional)
\i /path/to/services/shared/database/seed.sql

\q
```

### Step 2: Install Dependencies

```bash
cd /path/to/fraudwallet/services

# Install shared dependencies
cd shared && npm install && cd ..

# Install each service
cd auth-service && npm install && cd ..
cd user-service && npm install && cd ..
cd wallet-service && npm install && cd ..
cd splitpay-service && npm install && cd ..
cd fraud-detection-service && npm install && cd ..
cd api-gateway && npm install && cd ..
```

### Step 3: Configure Environment

Create `.env` in each service directory:

**services/auth-service/.env:**
```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fraudwallet
DB_USER=postgres
DB_PASSWORD=postgres123
JWT_SECRET=your-secret-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

Repeat for all services (change PORT for each).

### Step 4: Start Services

**Open separate terminals for each service:**

**Terminal 1 - Auth Service:**
```bash
cd services/auth-service
npm start
```

**Terminal 2 - User Service:**
```bash
cd services/user-service
npm start
```

**Terminal 3 - Wallet Service:**
```bash
cd services/wallet-service
npm start
```

**Terminal 4 - SplitPay Service:**
```bash
cd services/splitpay-service
npm start
```

**Terminal 5 - Fraud Detection Service:**
```bash
cd services/fraud-detection-service
npm start
```

**Terminal 6 - API Gateway:**
```bash
cd services/api-gateway
npm start
```

**Terminal 7 - Frontend:**
```bash
cd ../frontend
npm run dev
```

---

## Common Issues & Solutions

### Issue 1: Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
```bash
# Find process using port
lsof -ti:3001 | xargs kill -9

# Or on Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Issue 2: Database Connection Failed

**Error:** `Connection to database failed`

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Or on macOS
brew services list

# Verify connection
psql -U postgres -d fraudwallet -c "SELECT 1;"

# Check credentials in .env match your PostgreSQL setup
```

### Issue 3: Docker Build Errors

**Error:** `failed to solve with frontend dockerfile.v0`

**Solution:**
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker compose build --no-cache

# Start again
docker compose up
```

### Issue 4: Services Start but Immediately Exit

**Check logs:**
```bash
docker compose logs auth-service
```

**Common causes:**
- Missing environment variables
- Database not ready
- Node modules not installed

**Solution:**
```bash
# Ensure database is healthy first
docker compose up -d postgres
docker compose logs postgres

# Wait for "database system is ready to accept connections"

# Then start other services
docker compose up
```

### Issue 5: Cannot Access Services

**Symptoms:** Services running but http://localhost:3001 not accessible

**Solution:**
```bash
# Check if services are actually listening
docker compose ps

# Check service logs
docker compose logs -f auth-service

# Verify port mappings
docker compose port auth-service 3001

# Test from within container
docker compose exec auth-service curl http://localhost:3001/health
```

---

## Verification Checklist

After starting services, verify:

- [ ] PostgreSQL running on port 5432
- [ ] Redis running on port 6379
- [ ] Auth Service responding: `curl http://localhost:3001/health`
- [ ] User Service responding: `curl http://localhost:3002/health`
- [ ] Wallet Service responding: `curl http://localhost:3003/health`
- [ ] SplitPay Service responding: `curl http://localhost:3004/health`
- [ ] Fraud Detection responding: `curl http://localhost:3005/health`
- [ ] API Gateway responding: `curl http://localhost:8080/health`
- [ ] Frontend accessible: http://localhost:3000

---

## Quick Start Script

Save this as `start-dev.sh`:

```bash
#!/bin/bash

echo "🚀 Starting FraudWallet Microservices..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Navigate to services directory
cd "$(dirname "$0")/services"

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp .env.example .env
    echo "📝 Please edit .env with your configuration and run again."
    exit 1
fi

# Start services
echo "🐳 Starting Docker Compose..."
docker compose -f docker-compose.dev.yml up --build

# If that fails, try older syntax
if [ $? -ne 0 ]; then
    echo "Trying docker-compose command..."
    docker-compose -f docker-compose.dev.yml up --build
fi
```

Make executable and run:
```bash
chmod +x start-dev.sh
./start-dev.sh
```

---

## Need More Help?

1. **Check service logs:**
   ```bash
   docker compose logs -f [service-name]
   ```

2. **Check Docker status:**
   ```bash
   docker compose ps
   docker stats
   ```

3. **Reset everything:**
   ```bash
   docker compose down -v
   docker compose up --build
   ```

4. **Contact:** Open an issue on GitHub with:
   - Output of `docker compose logs`
   - Your OS and Docker version
   - Steps to reproduce the issue
