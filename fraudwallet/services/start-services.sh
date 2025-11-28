#!/bin/bash

# FraudWallet Development Services Startup Script
# This script starts all microservices manually (without Docker)

set -e

echo "🚀 Starting FraudWallet Microservices Development Environment"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PostgreSQL is running
echo -e "${YELLOW}Checking PostgreSQL...${NC}"
if ! pg_isready -h localhost -p 5432 &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not running on localhost:5432${NC}"
    echo "Please start PostgreSQL first:"
    echo "  - macOS: brew services start postgresql@15"
    echo "  - Linux: sudo systemctl start postgresql"
    echo "  - Windows: Start PostgreSQL service"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL is running${NC}"

# Check if database exists
echo -e "${YELLOW}Checking database 'fraudwallet'...${NC}"
if ! psql -U postgres -lqt | cut -d \| -f 1 | grep -qw fraudwallet; then
    echo -e "${YELLOW}Creating database 'fraudwallet'...${NC}"
    createdb -U postgres fraudwallet

    # Run schema
    echo -e "${YELLOW}Running database schema...${NC}"
    psql -U postgres -d fraudwallet -f shared/database/schema.sql

    echo -e "${GREEN}✓ Database created${NC}"
else
    echo -e "${GREEN}✓ Database exists${NC}"
fi

# Function to start a service
start_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3

    echo ""
    echo -e "${YELLOW}Starting ${service_name}...${NC}"

    cd "$service_dir"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing dependencies for ${service_name}...${NC}"
        npm install
    fi

    # Start service in background
    npm start > "/tmp/fraudwallet-${service_name}.log" 2>&1 &
    local pid=$!
    echo $pid > "/tmp/fraudwallet-${service_name}.pid"

    # Wait a bit for service to start
    sleep 2

    # Check if service is running
    if kill -0 $pid 2>/dev/null; then
        # Check if port is listening
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${GREEN}✓ ${service_name} started on port ${port} (PID: ${pid})${NC}"
        else
            echo -e "${YELLOW}⚠ ${service_name} process started but not listening on port ${port} yet${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to start ${service_name}${NC}"
        echo "Check logs: tail -f /tmp/fraudwallet-${service_name}.log"
    fi

    cd - > /dev/null
}

# Install shared dependencies first
echo -e "${YELLOW}Installing shared dependencies...${NC}"
cd shared
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..
echo -e "${GREEN}✓ Shared dependencies ready${NC}"

# Start all services
start_service "Auth Service" "auth-service" 3001
start_service "User Service" "user-service" 3002
start_service "Wallet Service" "wallet-service" 3003
start_service "SplitPay Service" "splitpay-service" 3004
start_service "Fraud Detection Service" "fraud-detection-service" 3005
start_service "API Gateway" "api-gateway" 8080

echo ""
echo "============================================================"
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "Service URLs:"
echo "  - Auth Service:            http://localhost:3001"
echo "  - User Service:            http://localhost:3002"
echo "  - Wallet Service:          http://localhost:3003"
echo "  - SplitPay Service:        http://localhost:3004"
echo "  - Fraud Detection Service: http://localhost:3005"
echo "  - API Gateway:             http://localhost:8080"
echo ""
echo "To check logs:"
echo "  tail -f /tmp/fraudwallet-*.log"
echo ""
echo "To stop all services:"
echo "  ./stop-services.sh"
echo ""
echo "Now start the frontend:"
echo "  cd ../frontend && npm run dev"
echo ""
