#!/bin/bash

# FraudWallet Quick Start Script
# This script will set up and start everything automatically

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "🚀 FraudWallet Quick Start"
echo "=========================="
echo ""

# Step 1: Check environment
echo -e "${BLUE}Step 1: Checking environment...${NC}"

if [ ! -f "docker-compose.dev.yml" ]; then
    echo -e "${RED}❌ Error: Must run from fraudwallet/services/ directory${NC}"
    exit 1
fi

# Step 2: Create .env if it doesn't exist
echo -e "${BLUE}Step 2: Setting up environment variables...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"

    # Generate JWT secret
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || echo "please-change-this-to-a-random-string-at-least-32-characters-long")

    cat > .env << EOF
# Auto-generated configuration
JWT_SECRET=${JWT_SECRET}

# Stripe Configuration
# Get these from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE

# Email Configuration for 2FA
# Get Gmail app password from: https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM="FraudWallet Security <your-email@gmail.com>"
EOF

    echo -e "${GREEN}✓ .env file created with auto-generated JWT secret${NC}"
    echo -e "${YELLOW}⚠️  You'll need to add Stripe keys later for payment features${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Step 3: Choose startup method
echo ""
echo -e "${BLUE}Step 3: Choose how to start services:${NC}"
echo ""
echo "  1) Docker Compose (Recommended - easiest)"
echo "  2) Manual (Run each service individually)"
echo "  3) Just install dependencies (don't start)"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}Starting with Docker Compose...${NC}"

        # Check Docker
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}❌ Docker not found${NC}"
            echo "Install Docker Desktop: https://www.docker.com/products/docker-desktop"
            exit 1
        fi

        if ! docker info &> /dev/null; then
            echo -e "${RED}❌ Docker daemon not running${NC}"
            echo "Please start Docker Desktop"
            exit 1
        fi

        echo -e "${GREEN}✓ Docker is ready${NC}"

        # Try docker compose (new) or docker-compose (old)
        if docker compose version &> /dev/null; then
            COMPOSE_CMD="docker compose"
        elif command -v docker-compose &> /dev/null; then
            COMPOSE_CMD="docker-compose"
        else
            echo -e "${RED}❌ docker-compose not found${NC}"
            exit 1
        fi

        echo ""
        echo -e "${YELLOW}Starting all services...${NC}"
        echo "This may take a few minutes on first run (downloading images, building containers)"
        echo ""

        $COMPOSE_CMD -f docker-compose.dev.yml up --build
        ;;

    2)
        echo ""
        echo -e "${BLUE}Starting services manually...${NC}"

        # Install dependencies
        echo -e "${YELLOW}Installing dependencies...${NC}"

        services=("shared" "auth-service" "user-service" "wallet-service" "splitpay-service" "fraud-detection-service" "api-gateway")

        for service in "${services[@]}"; do
            echo "  → Installing $service..."
            cd "$service"
            npm install --silent 2>&1 | grep -i error || true
            cd ..
        done

        echo -e "${GREEN}✓ Dependencies installed${NC}"

        # Check PostgreSQL
        echo ""
        echo -e "${YELLOW}Checking PostgreSQL...${NC}"

        if ! command -v psql &> /dev/null; then
            echo -e "${RED}❌ PostgreSQL not found${NC}"
            echo "Install PostgreSQL:"
            echo "  macOS: brew install postgresql@15"
            echo "  Linux: sudo apt install postgresql"
            exit 1
        fi

        if ! pg_isready -h localhost -p 5432 &> /dev/null; then
            echo -e "${RED}❌ PostgreSQL not running${NC}"
            echo "Start PostgreSQL:"
            echo "  macOS: brew services start postgresql@15"
            echo "  Linux: sudo systemctl start postgresql"
            exit 1
        fi

        # Create database if needed
        if ! psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw fraudwallet; then
            echo "Creating database..."
            createdb -U postgres fraudwallet
            psql -U postgres -d fraudwallet -f shared/database/schema.sql
            echo -e "${GREEN}✓ Database created${NC}"
        else
            echo -e "${GREEN}✓ Database exists${NC}"
        fi

        # Start services
        echo ""
        echo -e "${YELLOW}Starting services...${NC}"
        ./start-services.sh
        ;;

    3)
        echo ""
        echo -e "${BLUE}Installing dependencies only...${NC}"

        services=("shared" "auth-service" "user-service" "wallet-service" "splitpay-service" "fraud-detection-service" "api-gateway")

        for service in "${services[@]}"; do
            echo "  → Installing $service..."
            cd "$service"
            npm install --silent
            cd ..
        done

        echo -e "${GREEN}✓ All dependencies installed${NC}"
        echo ""
        echo "To start services:"
        echo "  Docker: docker compose -f docker-compose.dev.yml up"
        echo "  Manual: ./start-services.sh"
        ;;

    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "========================================"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Service URLs:"
echo "  → API Gateway:             http://localhost:8080"
echo "  → Auth Service:            http://localhost:3001"
echo "  → User Service:            http://localhost:3002"
echo "  → Wallet Service:          http://localhost:3003"
echo "  → SplitPay Service:        http://localhost:3004"
echo "  → Fraud Detection Service: http://localhost:3005"
echo ""
echo "Test health:"
echo "  curl http://localhost:8080/health"
echo ""
echo "Next steps:"
echo "  1. Start the frontend: cd ../frontend && npm run dev"
echo "  2. Access the app: http://localhost:3000"
echo ""
