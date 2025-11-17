# FraudWallet - Fraud Detection Payment Gateway

A secure payment gateway system with fraud detection, 2FA, split payments, and account ID features.

## Features

- ✅ User Authentication (Signup/Login with 2FA)
- ✅ Account ID System (12-digit unique IDs)
- ✅ Payment Transfer (by phone/email/Account ID)
- ✅ SplitPay - Bill splitting with friends
- ✅ QR Code generation for payments
- ✅ Profile management with security features

## Tech Stack

- **Backend**: Node.js, Express.js, SQLite
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Database**: SQLite (file-based)
- **Authentication**: JWT tokens, bcrypt
- **2FA**: Email codes via nodemailer

---

## Setup Options

You have **TWO ways** to run this project:

### Option 1: Docker (Recommended - Easiest)

**Requirements:** Only Docker Desktop installed

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd fraudwallet

# 2. Start everything with one command
docker-compose up

# That's it!
# Backend: http://localhost:8080
# Frontend: http://localhost:3000
```

**To stop:**
```bash
docker-compose down
```

**To rebuild after code changes:**
```bash
docker-compose up --build
```

---

### Option 2: Manual Setup (Traditional)

**Requirements:** Node.js 20+ and npm installed

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd fraudwallet

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment variables (if using Gmail for 2FA)
cp .env.example .env
# Edit .env with your Gmail credentials

# 4. Install frontend dependencies
cd ../frontend
npm install

# 5. Run backend (Terminal 1)
cd ../backend
node src/server.js

# 6. Run frontend (Terminal 2)
cd ../frontend
npm run dev
```

**Access the app:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

---

## Environment Variables

For Gmail 2FA to work, create `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
SMTP_FROM="FraudWallet Security <your-email@gmail.com>"
```

**Note:** Generate Gmail App Password at: https://myaccount.google.com/apppasswords

---

## Project Structure

```
fraudwallet/
├── backend/              # Node.js Express API
│   ├── src/
│   │   ├── server.js     # Main server entry
│   │   ├── auth.js       # Authentication logic
│   │   ├── user.js       # User management
│   │   ├── splitpay.js   # SplitPay feature
│   │   ├── database.js   # SQLite database setup
│   │   └── twofa.js      # 2FA implementation
│   ├── fraudwallet.db    # SQLite database file
│   └── package.json
│
├── frontend/             # Next.js React App
│   ├── src/
│   │   ├── app/          # Next.js app directory
│   │   └── components/   # React components
│   │       ├── dashboard-tab.tsx
│   │       ├── payment-tab.tsx
│   │       ├── splitpay-tab.tsx
│   │       └── profile-tab.tsx
│   └── package.json
│
├── docker-compose.yml    # Docker orchestration
└── README.md            # This file
```

---

## Common Issues

### "Missing packages" error on new PC

**Problem:** node_modules are not committed to git

**Solution:**
- **Docker:** Just run `docker-compose up` - dependencies install automatically
- **Manual:** Run `npm install` in both backend and frontend folders

### Port already in use

**Problem:** Another process is using port 8080 or 3000

**Solution:**
```bash
# Find and kill process on port
lsof -ti:8080 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Docker container won't start

**Problem:** Old containers still running

**Solution:**
```bash
docker-compose down
docker-compose up --build
```

---

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login with email/phone
- `POST /api/auth/verify-2fa` - Verify 2FA code

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `PUT /api/user/phone` - Change phone number
- `POST /api/user/2fa/toggle` - Enable/disable 2FA

### Payments
- `POST /api/payment/lookup-recipient` - Find user by phone/email/Account ID

### SplitPay
- `POST /api/splitpay/create` - Create split payment
- `GET /api/splitpay/my-splits` - Get my split requests
- `POST /api/splitpay/respond` - Accept/reject split
- `POST /api/splitpay/pay` - Pay my share

---

## Development

### Hot Reload
Both Docker and manual setup support hot reload:
- Backend: Automatic restart on file changes (add nodemon if needed)
- Frontend: Next.js Fast Refresh

### Database
SQLite database file: `backend/fraudwallet.db`
- Automatically created on first run
- Persists data between restarts
- Backup regularly for production

---

## License

For FYP@APU purpose. Copyright © 2025 Ryan Lee Khang Sern. All rights reserved.
