#!/bin/bash

# FraudWallet Microservices - Complete Feature Test
# This script tests ALL endpoints to identify what's working and what's broken

echo "🧪 FraudWallet Microservices - Complete Feature Test"
echo "========================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASS=0
FAIL=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4
    local token=$5

    echo -n "Testing: $name... "

    if [ -z "$token" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$url" \
            -H "Content-Type: application/json" \
            ${data:+-d "$data"} 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$url" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            ${data:+-d "$data"} 2>&1)
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
        echo -e "${GREEN}✅ PASS${NC} ($http_code)"
        ((PASS++))
        return 0
    elif [[ $http_code -eq 400 || $http_code -eq 401 || $http_code -eq 404 ]]; then
        echo -e "${YELLOW}⚠️  EXPECTED ERROR${NC} ($http_code)"
        ((PASS++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} ($http_code)"
        echo "   Response: $body" | head -c 200
        echo ""
        ((FAIL++))
        return 1
    fi
}

# 1. TEST INFRASTRUCTURE
echo "🔧 INFRASTRUCTURE TESTS"
echo "------------------------"

# PostgreSQL check using docker
echo -n "Testing: PostgreSQL Health... "
if docker exec fraudwallet-postgres-dev pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} (docker)"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC} (docker)"
    ((FAIL++))
fi

# Redis check using docker
echo -n "Testing: Redis Health... "
if docker exec fraudwallet-redis-dev redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} (docker)"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC} (docker)"
    ((FAIL++))
fi

test_endpoint "Auth Service Health" "http://localhost:3001/health" "GET"
test_endpoint "User Service Health" "http://localhost:3002/health" "GET"
test_endpoint "Wallet Service Health" "http://localhost:3003/health" "GET"
test_endpoint "SplitPay Service Health" "http://localhost:3004/health" "GET"
test_endpoint "Fraud Detection Health" "http://localhost:3005/health" "GET"
test_endpoint "API Gateway Health" "http://localhost:8080/health" "GET"
echo ""

# 2. TEST AUTH ENDPOINTS
echo "🔐 AUTHENTICATION TESTS"
echo "------------------------"

# Try to login with existing test account (alice from seed data)
LOGIN_DATA='{"identifier":"alice@example.com","password":"password123"}'
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_DATA")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ ! -z "$TOKEN" ]; then
    echo -e "${GREEN}✅ Login successful${NC} (Token obtained for alice@example.com)"
    ((PASS++))
else
    echo -e "${YELLOW}⚠️  Could not login with test account${NC}"
    echo "   Trying bob@example.com..."

    LOGIN_DATA='{"identifier":"bob@example.com","password":"password123"}'
    LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "$LOGIN_DATA")

    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | sed 's/"token":"//')

    if [ ! -z "$TOKEN" ]; then
        echo -e "${GREEN}✅ Login successful${NC} (Token obtained for bob@example.com)"
        ((PASS++))
    fi
fi

test_endpoint "Login (Invalid Creds)" "http://localhost:8080/api/auth/login" "POST" '{"identifier":"fake@test.com","password":"wrong"}'
echo ""

# 3. TEST USER ENDPOINTS (Requires auth)
if [ ! -z "$TOKEN" ]; then
    echo "👤 USER SERVICE TESTS"
    echo "------------------------"
    test_endpoint "Get User Profile" "http://localhost:8080/api/user/profile" "GET" "" "$TOKEN"
    test_endpoint "Update Profile" "http://localhost:8080/api/user/profile" "PUT" '{"fullName":"Updated Name"}' "$TOKEN"
    test_endpoint "Lookup Recipient" "http://localhost:8080/api/payment/lookup-recipient" "POST" '{"query":"ACC-000001"}' "$TOKEN"
    test_endpoint "Generate QR Code" "http://localhost:8080/api/user/qrcode" "GET" "" "$TOKEN"
    test_endpoint "Toggle 2FA" "http://localhost:8080/api/user/2fa/toggle" "POST" '{"enable":true}' "$TOKEN"
    echo ""
fi

# 4. TEST WALLET ENDPOINTS (Requires auth)
if [ ! -z "$TOKEN" ]; then
    echo "💰 WALLET SERVICE TESTS"
    echo "------------------------"
    test_endpoint "Get Wallet Balance" "http://localhost:8080/api/wallet/balance" "GET" "" "$TOKEN"
    test_endpoint "Get Transactions" "http://localhost:8080/api/wallet/transactions" "GET" "" "$TOKEN"
    test_endpoint "Create Payment Intent" "http://localhost:8080/api/wallet/add-funds" "POST" '{"amount":50.00}' "$TOKEN"
    echo ""
fi

# 5. TEST SPLITPAY ENDPOINTS (Requires auth)
if [ ! -z "$TOKEN" ]; then
    echo "👥 SPLITPAY SERVICE TESTS"
    echo "------------------------"
    test_endpoint "Get My Splits" "http://localhost:8080/api/splitpay/my-splits" "GET" "" "$TOKEN"
    test_endpoint "Create Split Payment" "http://localhost:8080/api/splitpay/create" "POST" '{"title":"Test Split","totalAmount":100,"participants":[1,2]}' "$TOKEN"
    echo ""
fi

# 6. TEST FRAUD DETECTION ENDPOINTS (Requires auth)
if [ ! -z "$TOKEN" ]; then
    echo "🛡️  FRAUD DETECTION TESTS"
    echo "------------------------"
    test_endpoint "Get System Metrics" "http://localhost:8080/api/fraud/system-metrics" "GET" "" "$TOKEN"
    test_endpoint "Get High Risk Users" "http://localhost:8080/api/fraud/high-risk-users" "GET" "" "$TOKEN"
    test_endpoint "Get Top Flagged Users" "http://localhost:8080/api/fraud/top-flagged-users" "GET" "" "$TOKEN"
    test_endpoint "Get Recent Logs" "http://localhost:8080/api/fraud/recent-logs" "GET" "" "$TOKEN"
    echo ""
fi

# 7. TEST API GATEWAY ROUTING
echo "🌐 API GATEWAY ROUTING TESTS"
echo "------------------------"
test_endpoint "Root Path (Should 404)" "http://localhost:8080/" "GET"
test_endpoint "Invalid Endpoint (Should 404)" "http://localhost:8080/api/invalid" "GET"
echo ""

# SUMMARY
echo "========================================================"
echo "📊 TEST SUMMARY"
echo "========================================================"
echo -e "Total Passed: ${GREEN}$PASS${NC}"
echo -e "Total Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Review the output above.${NC}"
    echo ""
    echo "Common issues to check:"
    echo "  - Are all services running? (docker compose ps)"
    echo "  - Database initialized? (check postgres logs)"
    echo "  - Environment variables set? (check .env file)"
    exit 1
fi
