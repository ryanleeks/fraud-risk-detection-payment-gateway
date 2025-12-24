# 🚀 Microservices Implementation Guide (3-4 Days)

## ✅ What's Been Done

I've created a **simplified microservices architecture** by extracting the fraud detection system into its own microservice. Here's what's ready:

### 📁 New Structure
```
fraudwallet/
├── backend/                    # Main monolith (Auth, User, Wallet, Payment, 2FA, SplitPay)
│   ├── src/
│   │   ├── fraudServiceClient.js     # NEW: HTTP client for fraud service
│   │   ├── fraudDetectionAPIProxy.js # NEW: Proxy fraud API to microservice
│   │   └── ...
│
├── fraud-service/              # NEW: Fraud Detection Microservice
│   ├── src/
│   │   ├── server.js          # Fraud service API
│   │   ├── database.js        # Shared DB access
│   │   └── fraud-detection/   # All fraud detection code
│   ├── Dockerfile
│   └── package.json
│
├── nginx/                      # NEW: Reverse proxy
│   └── nginx.conf
│
├── docker-compose.microservices.yml  # NEW: Orchestration
└── .env.production.example
```

### 🎯 Architecture

**Before (Monolith):**
```
Frontend → Backend (everything)
```

**After (Microservices):**
```
                    ┌─────────┐
                    │  Nginx  │ (Port 80/443)
                    └────┬────┘
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌─────▼─────┐   ┌────▼────────┐
    │Frontend │    │  Backend  │   │   Fraud     │
    │ (Next)  │    │ Monolith  │───│  Service    │
    │ :3000   │    │  :8080    │   │   :8085     │
    └─────────┘    └─────┬─────┘   └─────┬───────┘
                         │               │
                    ┌────▼───────────────▼────┐
                    │ SQLite (Shared Volume)  │
                    └─────────────────────────┘
```

**What each service does:**

1. **Frontend**: User interface (no changes)
2. **Backend Monolith**: Auth, User, Wallet, Payment, 2FA, SplitPay
   - Calls fraud service via HTTP when checking transactions
3. **Fraud Service** (NEW MICROSERVICE):
   - Fraud detection rules
   - Risk scoring
   - Fraud logging
   - Analytics API

---

## 📅 3-4 DAY IMPLEMENTATION PLAN

### **DAY 1: Local Development & Testing** (Today)

#### Hour 1-2: Install Dependencies & Build
```bash
# Navigate to fraud service
cd fraudwallet/fraud-service
npm install

# Navigate to backend
cd ../backend
# No changes needed - just verify existing packages

# Navigate to frontend
cd ../frontend
# No changes needed
```

#### Hour 3-4: Test Locally (Without Docker)

**Terminal 1: Start Fraud Service**
```bash
cd fraudwallet/fraud-service
mkdir -p ../data
export DB_PATH=../data/fraudwallet.db
npm start
# Should see: 🔍 Fraud Detection Service running on port 8085
```

**Terminal 2: Start Backend**
```bash
cd fraudwallet/backend
export FRAUD_SERVICE_URL=http://localhost:8085
npm start
# Should see: ✅ Server is running on http://localhost:8080
```

**Terminal 3: Start Frontend**
```bash
cd fraudwallet/frontend
npm run dev
# Should see: - Local: http://localhost:3000
```

**Test**: Open http://localhost:3000, login, make a transfer → fraud detection should work!

#### Hour 5-6: Docker Compose Testing

```bash
cd fraudwallet

# Copy environment variables
cp .env.production.example .env.production
# Edit .env.production with your actual Stripe keys, SMTP, etc.

# Build and start all services
docker-compose -f docker-compose.microservices.yml up --build

# Access at: http://localhost
```

**Verify:**
- [ ] Frontend loads at http://localhost
- [ ] Can login/signup
- [ ] Can make a transfer
- [ ] Fraud detection works (check logs: `docker-compose logs fraud-service`)

#### Hour 7-8: Bug Fixes & Refinement

Fix any issues that come up. Common problems:
- Database not found → Check volume mounting
- Fraud service unreachable → Check Docker network
- Frontend can't reach backend → Check Nginx config

---

### **DAY 2: AWS Deployment** (Tomorrow)

#### Hour 1: Create EC2 Instance

1. **Launch EC2 Instance**
   - Go to AWS Console → EC2 → Launch Instance
   - **Name**: fraudwallet-production
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance Type**: t3.small (2 vCPU, 2GB RAM) - $15/month
     - Or t2.micro (free tier) - 1GB RAM, might be slow
   - **Key Pair**: Create new or use existing (download .pem file!)
   - **Security Group**: Create new
     - SSH (22) - Your IP only
     - HTTP (80) - 0.0.0.0/0
     - HTTPS (443) - 0.0.0.0/0
   - **Storage**: 30GB gp3
   - **Launch Instance**

2. **Allocate Elastic IP** (Optional but recommended)
   - EC2 → Elastic IPs → Allocate
   - Associate with your instance
   - **Copy this IP** - you'll need it for DNS

#### Hour 2: Setup Domain

**Point your domain to EC2:**
1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add A record:
   ```
   Type: A
   Name: @ (or subdomain like "app")
   Value: <Your EC2 Elastic IP>
   TTL: 300
   ```
3. Wait 5-10 minutes for DNS propagation

**Test DNS:**
```bash
ping yourdomain.com
# Should show your EC2 IP
```

#### Hour 3-4: Setup EC2 Environment

**SSH into EC2:**
```bash
# On your local machine
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2-IP>
```

**Run setup script:**
```bash
# On EC2 instance
curl -o setup-ec2.sh https://raw.githubusercontent.com/yourusername/fraud-risk-detection-payment-gateway/main/deployment/setup-ec2.sh
chmod +x setup-ec2.sh
./setup-ec2.sh

# IMPORTANT: Logout and login again
exit
ssh -i your-key.pem ubuntu@<EC2-IP>
```

#### Hour 5-6: Deploy Application

**Clone repository:**
```bash
cd ~
git clone https://github.com/yourusername/fraud-risk-detection-payment-gateway.git app
cd app/fraudwallet
```

**Setup environment:**
```bash
cp .env.production.example .env.production
nano .env.production
# Add your Stripe keys, SMTP credentials, JWT secret
```

**Deploy:**
```bash
docker-compose -f docker-compose.microservices.yml up -d --build
```

**Check status:**
```bash
docker-compose -f docker-compose.microservices.yml ps
docker-compose -f docker-compose.microservices.yml logs -f
```

#### Hour 7-8: Setup SSL (HTTPS)

**Get SSL certificate:**
```bash
# Stop nginx temporarily
docker-compose -f docker-compose.microservices.yml stop nginx

# Get certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/app/fraudwallet/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ~/app/fraudwallet/nginx/ssl/
sudo chown ubuntu:ubuntu ~/app/fraudwallet/nginx/ssl/*.pem
```

**Update nginx config:**
```bash
nano ~/app/fraudwallet/nginx/nginx.conf

# Uncomment the HTTPS server block (lines starting with #)
# Replace "yourdomain.com" with your actual domain
```

**Restart nginx:**
```bash
docker-compose -f docker-compose.microservices.yml up -d nginx
```

**Test:**
- http://yourdomain.com → Should redirect to HTTPS
- https://yourdomain.com → Should show your app! 🎉

---

### **DAY 3: Testing & Bug Fixes**

#### End-to-End Testing Checklist

- [ ] **Signup**: Create new account
- [ ] **Login**: Login with email/password
- [ ] **2FA**: Enable 2FA, test email OTP
- [ ] **Add Funds**: Use Stripe test card (4242 4242 4242 4242)
- [ ] **Transfer Money**: Send money to another user
- [ ] **Fraud Detection**:
  - Make large transfer (>50,000) → Should trigger AMT-001
  - Make 6 rapid transfers → Should trigger VEL-001
  - Check fraud logs appear
- [ ] **SplitPay**: Create and pay split payment
- [ ] **Profile**: Update profile, change phone

#### Performance Testing

**Load test (optional but good for report):**
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test: 100 requests, 10 concurrent
ab -n 100 -c 10 https://yourdomain.com/api/health

# Measure fraud service performance
ab -n 100 -c 10 -p post.json -T application/json https://yourdomain.com/api/fraud/system-metrics
```

#### Monitoring Setup

**View logs:**
```bash
# All services
docker-compose -f docker-compose.microservices.yml logs -f

# Just fraud service
docker-compose -f docker-compose.microservices.yml logs -f fraud-service

# Just backend
docker-compose -f docker-compose.microservices.yml logs -f backend
```

**Create monitoring dashboard** (simple script):
```bash
#!/bin/bash
# monitor.sh
while true; do
  clear
  echo "=== FRAUDWALLET STATUS ==="
  echo ""
  docker-compose -f ~/app/fraudwallet/docker-compose.microservices.yml ps
  echo ""
  echo "=== RESOURCE USAGE ==="
  docker stats --no-stream
  sleep 5
done
```

#### Bug Fixes

Common issues:

**1. Fraud service can't connect to database**
```bash
# Check volume mounting
docker volume ls
docker volume inspect fraudwallet_shared-data

# Recreate volume
docker-compose down -v
docker-compose up -d
```

**2. Backend can't reach fraud service**
```bash
# Check network
docker network inspect fraudwallet_fraudwallet-network

# Verify fraud service is running
curl http://localhost:8085/health
```

**3. SSL certificate expired**
```bash
# Renew certificate
sudo certbot renew
./deployment/ssl-setup.sh yourdomain.com
```

---

### **DAY 4: Final Polish & Documentation**

#### Create System Diagram

Use draw.io or similar to create:
1. Architecture diagram (before/after microservices)
2. Database schema
3. API flow diagram
4. Fraud detection decision tree

#### Collect Metrics for Report

**1. Performance Comparison**

Run same test on both architectures:
```bash
# Monolith (if you kept the old code)
time curl -X POST http://localhost:8080/api/wallet/send ...

# Microservices
time curl -X POST http://yourdomain.com/api/wallet/send ...
```

**2. Resource Usage**
```bash
docker stats --no-stream > metrics.txt
```

**3. Fraud Detection Effectiveness**
```sql
# Export fraud logs
sqlite3 ~/app/fraudwallet/data/fraudwallet.db <<EOF
.headers on
.mode csv
.output fraud_stats.csv
SELECT * FROM fraud_logs;
.quit
EOF
```

**4. Scalability Test**

Show that fraud service can scale independently:
```bash
# Scale fraud service to 3 instances
docker-compose -f docker-compose.microservices.yml up -d --scale fraud-service=3
```

#### Screenshots for Report

Capture:
- [ ] System architecture (Docker containers)
- [ ] Working application (dashboard, transfer, fraud detection)
- [ ] AWS EC2 dashboard
- [ ] Docker Compose running
- [ ] Fraud detection logs
- [ ] Performance metrics
- [ ] SSL certificate (HTTPS lock)

#### Create Demo Video (5-10 minutes)

1. Show architecture diagram
2. Show Docker Compose setup
3. Demo the application (login, transfer, fraud detection)
4. Show logs (fraud service detecting fraud)
5. Show it running on AWS
6. Explain microservices benefits

---

## 📊 FOR YOUR REPORT

### Key Points to Highlight

**1. Microservices Architecture Achieved**
- Extracted fraud detection as independent microservice
- Backend and fraud service communicate via REST API
- Containerized using Docker
- Deployed on AWS EC2

**2. Benefits Demonstrated**
- **Independent Scaling**: Fraud service can scale separately
- **Technology Flexibility**: Could rewrite fraud service in Python for ML
- **Fault Isolation**: If fraud service crashes, other features still work
- **Independent Deployment**: Can update fraud rules without touching backend

**3. Trade-offs & Justification**
- **Shared Database**: Acceptable for FYP scope, production would use separate DBs
- **Synchronous HTTP**: Simpler than message queues, adequate for demonstration
- **Single EC2**: Cost-effective for thesis, production would use ECS/EKS

**4. Alignment with Project Objectives**
- ✅ Fraud Detection System: Implemented with 15+ rules
- ✅ Containerized Microservices: Docker + Docker Compose
- ✅ Cloud-Based: Deployed on AWS EC2
- ✅ Digital Payment Environment: Stripe integration working

### Metrics to Include

| Metric | Value | How to Get It |
|--------|-------|---------------|
| Total Services | 3 (Frontend, Backend, Fraud) | `docker-compose ps` |
| Fraud Detection Response Time | ~50-100ms | Load testing with `ab` |
| Container Startup Time | ~30s | `docker-compose up` logs |
| Memory Usage per Service | 100-200MB | `docker stats` |
| Fraud Rules Implemented | 15+ | Count in code |
| API Endpoints | 20+ | Count in `server.js` |
| Uptime | 99.9%+ | Monitor for a week |

---

## 🔧 Common Commands

### Development
```bash
# Start locally (without Docker)
cd fraud-service && npm start  # Terminal 1
cd backend && npm start        # Terminal 2
cd frontend && npm run dev     # Terminal 3

# Start with Docker Compose
docker-compose -f docker-compose.microservices.yml up --build

# Rebuild specific service
docker-compose -f docker-compose.microservices.yml up --build fraud-service

# View logs
docker-compose logs -f fraud-service
```

### Production (AWS)
```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@<EC2-IP>

# Deploy updates
cd ~/app
git pull
docker-compose -f fraudwallet/docker-compose.microservices.yml up -d --build

# Check status
docker-compose -f fraudwallet/docker-compose.microservices.yml ps
docker-compose -f fraudwallet/docker-compose.microservices.yml logs -f

# Restart service
docker-compose -f fraudwallet/docker-compose.microservices.yml restart fraud-service

# Stop everything
docker-compose -f fraudwallet/docker-compose.microservices.yml down
```

### Debugging
```bash
# Enter container
docker exec -it fraudwallet-fraud-service sh

# Check database
docker exec -it fraudwallet-backend sh
sqlite3 /app/data/fraudwallet.db
SELECT * FROM fraud_logs LIMIT 10;

# Check network connectivity
docker exec -it fraudwallet-backend ping fraud-service
```

---

## 🚨 Troubleshooting

### Issue: "Cannot connect to fraud service"
```bash
# Check if fraud service is running
docker ps | grep fraud-service

# Check logs
docker logs fraudwallet-fraud-service

# Restart fraud service
docker-compose -f docker-compose.microservices.yml restart fraud-service
```

### Issue: "Database locked"
```bash
# Stop all services
docker-compose -f docker-compose.microservices.yml down

# Remove volume
docker volume rm fraudwallet_shared-data

# Start again
docker-compose -f docker-compose.microservices.yml up -d
```

### Issue: "Port already in use"
```bash
# Check what's using the port
sudo lsof -i :8080
sudo lsof -i :8085

# Kill the process
sudo kill -9 <PID>
```

### Issue: "SSL certificate error"
```bash
# Check certificate files
ls -la ~/app/fraudwallet/nginx/ssl/

# Renew certificate
sudo certbot renew

# Restart nginx
docker-compose restart nginx
```

---

## 💰 Estimated AWS Costs

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| EC2 t3.small | $15 | 2 vCPU, 2GB RAM |
| EBS Storage (30GB) | $3 | gp3 SSD |
| Elastic IP | $0 | Free when attached |
| Data Transfer | $1-5 | First 100GB free |
| **Total** | **~$20/month** | Can use t2.micro free tier for first year |

**Free Tier (First 12 Months):**
- t2.micro: 750 hours/month free
- 30GB EBS: Free
- **Total: ~$0-5/month**

---

## ✅ Success Criteria

You'll know it's working when:
- [ ] Can access https://yourdomain.com
- [ ] Can signup, login, make transfers
- [ ] Fraud detection triggers on large/rapid transfers
- [ ] Can see fraud logs in database
- [ ] All 3 containers running (`docker ps` shows 4: nginx, frontend, backend, fraud-service)
- [ ] Logs show "Fraud Service" being called
- [ ] Can update fraud service independently

---

## 📞 Quick Reference

**Local URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Fraud Service: http://localhost:8085
- Nginx: http://localhost

**Production URLs:**
- Main App: https://yourdomain.com
- API: https://yourdomain.com/api/*
- Health Check: https://yourdomain.com/health

**Files to Edit:**
- Environment: `fraudwallet/.env.production`
- Nginx Config: `fraudwallet/nginx/nginx.conf`
- Docker Compose: `fraudwallet/docker-compose.microservices.yml`

**Important Commands:**
- Start: `docker-compose -f docker-compose.microservices.yml up -d`
- Stop: `docker-compose -f docker-compose.microservices.yml down`
- Logs: `docker-compose -f docker-compose.microservices.yml logs -f`
- Rebuild: `docker-compose -f docker-compose.microservices.yml up -d --build`

---

## 🎓 For Your Thesis

**What to write:**

1. **Introduction**: Explain move from monolith to microservices
2. **Architecture**: Diagram showing before/after
3. **Implementation**: How you extracted fraud service
4. **Deployment**: Docker Compose + AWS EC2 setup
5. **Testing**: Performance metrics, fraud detection accuracy
6. **Results**: Benefits demonstrated (scalability, independence, etc.)
7. **Limitations**: Shared DB, single EC2, no auto-scaling
8. **Future Work**: Database per service, Kubernetes, ML models

**Appendices:**
- Docker Compose configuration
- Nginx configuration
- API documentation
- Fraud detection rules list
- Test results
- Screenshots

---

Good luck! You've got this! 🚀

If anything breaks, check the logs first:
```bash
docker-compose -f docker-compose.microservices.yml logs -f
```

The logs will tell you exactly what's wrong.
