#!/bin/bash

# FraudWallet Services Diagnostic Script
# Run this to diagnose why services aren't working

echo "🔍 FraudWallet Services Diagnostic Tool"
echo "========================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.dev.yml" ]; then
    echo -e "${RED}❌ Error: Not in services directory${NC}"
    echo "Please run from: fraudwallet/services/"
    exit 1
fi

echo -e "${BLUE}1. Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker is installed${NC}"
    docker --version

    # Check if Docker daemon is running
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓ Docker daemon is running${NC}"
    else
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        echo "Start Docker Desktop (macOS/Windows) or run: sudo systemctl start docker (Linux)"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Docker is not installed${NC}"
    echo "Install from: https://www.docker.com/products/docker-desktop"
fi

echo ""
echo -e "${BLUE}2. Checking for running containers...${NC}"
if command -v docker &> /dev/null; then
    RUNNING=$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep fraudwallet)
    if [ -z "$RUNNING" ]; then
        echo -e "${YELLOW}⚠ No FraudWallet containers running${NC}"
    else
        echo -e "${GREEN}Running containers:${NC}"
        echo "$RUNNING"
    fi
fi

echo ""
echo -e "${BLUE}3. Checking for listening ports...${NC}"
for port in 3001 3002 3003 3004 3005 8080; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        PID=$(lsof -ti :$port)
        PROCESS=$(ps -p $PID -o comm=)
        echo -e "${GREEN}✓ Port $port: LISTENING (PID: $PID, Process: $PROCESS)${NC}"
    else
        echo -e "${RED}✗ Port $port: NOT LISTENING${NC}"
    fi
done

echo ""
echo -e "${BLUE}4. Checking environment file...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"

    # Check critical variables
    if grep -q "JWT_SECRET=your-super-secret" .env; then
        echo -e "${YELLOW}⚠ JWT_SECRET not configured (still has default value)${NC}"
    elif grep -q "JWT_SECRET=" .env && [ -n "$(grep JWT_SECRET= .env | cut -d'=' -f2)" ]; then
        echo -e "${GREEN}✓ JWT_SECRET is set${NC}"
    else
        echo -e "${RED}✗ JWT_SECRET is missing${NC}"
    fi

    if grep -q "STRIPE_SECRET_KEY=sk_" .env; then
        echo -e "${GREEN}✓ STRIPE_SECRET_KEY appears configured${NC}"
    else
        echo -e "${YELLOW}⚠ STRIPE_SECRET_KEY may not be configured${NC}"
    fi
else
    echo -e "${RED}✗ .env file NOT FOUND${NC}"
    echo "Run: cp .env.example .env"
fi

echo ""
echo -e "${BLUE}5. Checking PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL client installed${NC}"

    if pg_isready -h localhost -p 5432 &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL is running${NC}"

        # Check if database exists
        if psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw fraudwallet; then
            echo -e "${GREEN}✓ Database 'fraudwallet' exists${NC}"
        else
            echo -e "${YELLOW}⚠ Database 'fraudwallet' does not exist${NC}"
            echo "Run: createdb -U postgres fraudwallet"
        fi
    else
        echo -e "${RED}✗ PostgreSQL is not running on localhost:5432${NC}"
    fi
else
    echo -e "${YELLOW}⚠ PostgreSQL client not installed${NC}"
fi

echo ""
echo -e "${BLUE}6. Testing service endpoints...${NC}"
for port in 8080 3001 3002 3003 3004 3005; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✓ Port $port: Health check OK${NC}"
    else
        echo -e "${RED}✗ Port $port: Health check FAILED${NC}"
    fi
done

echo ""
echo -e "${BLUE}7. Checking node_modules...${NC}"
MISSING_DEPS=0
for service in auth-service user-service wallet-service splitpay-service fraud-detection-service api-gateway shared; do
    if [ -d "$service/node_modules" ]; then
        echo -e "${GREEN}✓ $service/node_modules exists${NC}"
    else
        echo -e "${RED}✗ $service/node_modules missing${NC}"
        MISSING_DEPS=1
    fi
done

echo ""
echo "========================================"
echo -e "${YELLOW}📋 RECOMMENDATIONS:${NC}"
echo ""

# Generate recommendations based on findings
if ! command -v docker &> /dev/null; then
    echo "→ Install Docker: https://www.docker.com/products/docker-desktop"
fi

if [ ! -f ".env" ]; then
    echo "→ Create .env file: cp .env.example .env"
    echo "→ Generate JWT secret: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
fi

if ! docker ps &> /dev/null | grep -q fraudwallet; then
    echo "→ Start services with Docker:"
    echo "  docker compose -f docker-compose.dev.yml up"
    echo ""
    echo "→ OR start manually:"
    echo "  ./start-services.sh"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo "→ Install dependencies:"
    echo "  cd shared && npm install && cd .."
    echo "  cd auth-service && npm install && cd .."
    echo "  cd user-service && npm install && cd .."
    echo "  cd wallet-service && npm install && cd .."
    echo "  cd splitpay-service && npm install && cd .."
    echo "  cd fraud-detection-service && npm install && cd .."
    echo "  cd api-gateway && npm install && cd .."
fi

if ! pg_isready -h localhost -p 5432 &> /dev/null; then
    echo "→ Start PostgreSQL:"
    echo "  macOS: brew services start postgresql@15"
    echo "  Linux: sudo systemctl start postgresql"
fi

echo ""
echo "For detailed logs:"
echo "  Docker: docker compose logs -f"
echo "  Manual: tail -f /tmp/fraudwallet-*.log"
echo ""
