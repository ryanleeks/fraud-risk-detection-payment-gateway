# FraudWallet Setup for Windows/WSL

## You're on Windows! Here's the easiest way to start services:

---

## ✅ **Option 1: Docker Desktop (EASIEST - Recommended)**

### Step 1: Install Docker Desktop for Windows
1. Download: https://www.docker.com/products/docker-desktop
2. Install and start Docker Desktop
3. Enable WSL 2 integration in Docker Desktop settings

### Step 2: Open PowerShell or WSL Terminal

```bash
# Navigate to services directory
cd /mnt/c/Users/User/Documents/fraud-risk-detection-payment-gateway/fraudwallet/services

# Create .env file
cp .env.example .env
```

### Step 3: Edit .env file

Open `.env` in Notepad or VS Code and add:

```env
JWT_SECRET=your-random-secret-here-at-least-32-characters-long
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy
```

Or generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 4: Start Services

```bash
docker compose -f docker-compose.dev.yml up
```

---

## ✅ **Option 2: Manual Setup (If Docker doesn't work)**

### Prerequisites:
1. **PostgreSQL for Windows**: https://www.postgresql.org/download/windows/
2. **Node.js 20+**: https://nodejs.org/

### Setup Steps:

#### 1. Start PostgreSQL
- Start PostgreSQL service from Windows Services
- Or use pgAdmin to start the server

#### 2. Create Database

Open PowerShell or Command Prompt:
```powershell
# Using psql command (add to PATH if needed)
psql -U postgres -c "CREATE DATABASE fraudwallet;"

# Run schema
psql -U postgres -d fraudwallet -f "C:\Users\User\Documents\fraud-risk-detection-payment-gateway\fraudwallet\services\shared\database\schema.sql"
```

#### 3. Install Dependencies

In PowerShell or WSL:
```bash
cd /mnt/c/Users/User/Documents/fraud-risk-detection-payment-gateway/fraudwallet/services

# Install for each service
cd shared && npm install && cd ..
cd auth-service && npm install && cd ..
cd user-service && npm install && cd ..
cd wallet-service && npm install && cd ..
cd splitpay-service && npm install && cd ..
cd fraud-detection-service && npm install && cd ..
cd api-gateway && npm install && cd ..
```

#### 4. Create .env files

For each service directory, create `.env`:

**services/.env:**
```env
JWT_SECRET=your-random-secret-32-chars-minimum
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy
```

**services/auth-service/.env:**
```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fraudwallet
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-random-secret-32-chars-minimum
```

Repeat for all services (change PORT for each: 3002, 3003, 3004, 3005, 8080)

#### 5. Start Each Service in Separate Windows

**PowerShell Window 1 - Auth Service:**
```powershell
cd C:\Users\User\Documents\fraud-risk-detection-payment-gateway\fraudwallet\services\auth-service
npm start
```

**PowerShell Window 2 - User Service:**
```powershell
cd C:\Users\User\Documents\fraud-risk-detection-payment-gateway\fraudwallet\services\user-service
npm start
```

**PowerShell Window 3 - Wallet Service:**
```powershell
cd C:\Users\User\Documents\fraud-risk-detection-payment-gateway\fraudwallet\services\wallet-service
npm start
```

**PowerShell Window 4 - SplitPay Service:**
```powershell
cd C:\Users\User\Documents\fraud-risk-detection-payment-gateway\fraudwallet\services\splitpay-service
npm start
```

**PowerShell Window 5 - Fraud Detection Service:**
```powershell
cd C:\Users\User\Documents\fraud-risk-detection-payment-gateway\fraudwallet\services\fraud-detection-service
npm start
```

**PowerShell Window 6 - API Gateway:**
```powershell
cd C:\Users\User\Documents\fraud-risk-detection-payment-gateway\fraudwallet\services\api-gateway
npm start
```

---

## 🧪 **Test Services**

Open a new PowerShell or WSL terminal:

```bash
# Test API Gateway
curl http://localhost:8080/health

# Test individual services
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
```

Or open in browser:
- http://localhost:8080/health
- http://localhost:3001/health
- etc.

---

## 🛠️ **Windows-Specific Troubleshooting**

### Fix Line Ending Issues (CRLF → LF)

If you get `$'\r': command not found`:

```bash
# In WSL, convert all scripts
cd /mnt/c/Users/User/Documents/fraud-risk-detection-payment-gateway/fraudwallet/services
sed -i 's/\r$//' *.sh
```

Or use VS Code:
1. Open the .sh file
2. Click "CRLF" in bottom right
3. Select "LF"
4. Save

### Port Already in Use

```powershell
# Find process using port
netstat -ano | findstr :8080

# Kill process (replace PID with the number from above)
taskkill /PID <PID> /F
```

### PostgreSQL Not Starting

1. Open Windows Services (services.msc)
2. Find "postgresql-x64-15"
3. Right-click → Start

---

## 🎯 **Recommended Approach for Windows**

**Use Docker Desktop** - it's the easiest option:

1. Install Docker Desktop
2. Enable WSL 2 integration
3. Open WSL or PowerShell
4. Run:
   ```bash
   cd /mnt/c/Users/User/Documents/fraud-risk-detection-payment-gateway/fraudwallet/services
   docker compose -f docker-compose.dev.yml up
   ```

That's it! All services will start automatically.

---

## 📝 **Quick Reference**

**Stop Docker services:**
```bash
docker compose down
```

**Rebuild Docker containers:**
```bash
docker compose -f docker-compose.dev.yml up --build
```

**View logs:**
```bash
docker compose logs -f
```

**Check running containers:**
```bash
docker ps
```

---

## 💡 **Still Having Issues?**

1. **Make sure Docker Desktop is running** (check system tray)
2. **Verify WSL 2 is enabled**: `wsl --list --verbose`
3. **Check Docker integration**: Docker Desktop → Settings → Resources → WSL Integration
4. **Restart Docker Desktop**

For more help, share the output of:
```bash
docker compose -f docker-compose.dev.yml up
```
