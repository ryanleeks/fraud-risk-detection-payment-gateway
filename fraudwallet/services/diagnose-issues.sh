#!/bin/bash

# Diagnostic script to identify what's not working

echo "🔍 FraudWallet Diagnostics"
echo "========================================"
echo ""

# Check database users
echo "📊 Database Users:"
echo "-------------------"
docker exec fraudwallet-postgres-dev psql -U postgres -d fraudwallet -c "SELECT id, email, full_name, account_id, created_at FROM users ORDER BY id LIMIT 10;"
echo ""

# Try manual login with alice
echo "🔐 Testing Login with alice@example.com:"
echo "-------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
echo "HTTP Code: $HTTP_CODE"
echo "Response: $BODY"
echo ""

# Try manual login with bob
echo "🔐 Testing Login with bob@example.com:"
echo "-------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"password123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
echo "HTTP Code: $HTTP_CODE"
echo "Response: $BODY"
echo ""

# Check auth service logs
echo "📋 Auth Service Logs (last 20 lines):"
echo "-------------------"
docker logs fraudwallet-auth-service --tail 20
echo ""

# Check API Gateway logs
echo "📋 API Gateway Logs (last 20 lines):"
echo "-------------------"
docker logs fraudwallet-api-gateway --tail 20
echo ""

echo "========================================"
echo "✅ Diagnostics Complete"
