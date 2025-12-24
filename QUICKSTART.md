# ⚡ QUICK START (30 Minutes)

## 🎯 Goal
Get microservices running locally in 30 minutes.

---

## Step 1: Install Dependencies (5 min)

```bash
cd fraudwallet/fraud-service
npm install

cd ../backend
# Already has node_modules? Skip. Otherwise:
npm install

cd ../frontend
# Already has node_modules? Skip. Otherwise:
npm install
```

---

## Step 2: Test Without Docker (10 min)

**Terminal 1 - Fraud Service:**
```bash
cd fraudwallet/fraud-service
mkdir -p ../data
DB_PATH=../data/fraudwallet.db npm start
```
✅ Should see: `🔍 Fraud Detection Service running on port 8085`

**Terminal 2 - Backend:**
```bash
cd fraudwallet/backend
FRAUD_SERVICE_URL=http://localhost:8085 npm start
```
✅ Should see: `✅ Server is running on http://localhost:8080`

**Terminal 3 - Frontend:**
```bash
cd fraudwallet/frontend
npm run dev
```
✅ Should see: `- Local: http://localhost:3000`

**Test:**
- Open http://localhost:3000
- Signup/Login
- Make a transfer
- Check Terminal 1 for fraud detection logs ✅

---

## Step 3: Test With Docker (15 min)

**Stop all terminals from Step 2 (Ctrl+C)**

```bash
cd fraudwallet

# Copy environment file
cp .env.production.example .env.production

# Edit .env.production (add your Stripe keys)
nano .env.production
# Or use vim, code, etc.

# Start everything
docker-compose -f docker-compose.microservices.yml up --build

# Wait 2-3 minutes for build...
```

**Test:**
- Open http://localhost
- Should see your app! ✅
- Check logs in terminal

**View specific service logs:**
```bash
# New terminal
cd fraudwallet
docker-compose -f docker-compose.microservices.yml logs -f fraud-service
```

---

## ✅ Success!

If you see:
- Frontend at http://localhost
- Can login/signup
- Transfers work
- Fraud detection logs appear

**You're ready for AWS deployment!** 🎉

See [MICROSERVICES_IMPLEMENTATION.md](MICROSERVICES_IMPLEMENTATION.md) for full guide.

---

## 🆘 Quick Fixes

**"Port already in use":**
```bash
# Stop old processes
lsof -ti:8080 | xargs kill -9
lsof -ti:8085 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

**"Cannot connect to fraud service":**
```bash
# Check if it's running
docker ps | grep fraud-service

# Restart it
docker-compose restart fraud-service
```

**"Database locked":**
```bash
# Stop everything
docker-compose down

# Remove volumes
docker volume prune

# Start again
docker-compose up --build
```

---

**Next:** Deploy to AWS (Day 2) - See full guide.
