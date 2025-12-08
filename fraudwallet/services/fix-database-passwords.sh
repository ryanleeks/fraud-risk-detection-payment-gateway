#!/bin/bash

set -e

echo "🔧 Fixing FraudWallet Database Password Hashes"
echo "=============================================="
echo ""

# Step 1: Generate proper bcrypt hash for Test1234!
echo "📝 Step 1: Generating bcrypt hash for password 'Test1234!'..."
HASH=$(docker exec fraudwallet-auth-service node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Test1234!', 10).then(hash => console.log(hash))")
echo "✅ Hash generated: $HASH"
echo ""

# Step 2: Update seed.sql with the proper hash
echo "📝 Step 2: Updating seed.sql with proper password hash..."
sed -i "s/\$2b\$10\$YourBcryptHashHere/$HASH/g" shared/database/seed.sql
echo "✅ seed.sql updated"
echo ""

# Step 3: Drop and recreate database
echo "📝 Step 3: Dropping existing database..."
docker exec fraudwallet-postgres-dev psql -U postgres -c "DROP DATABASE IF EXISTS fraudwallet;"
echo "✅ Database dropped"
echo ""

echo "📝 Step 4: Creating fresh database..."
docker exec fraudwallet-postgres-dev psql -U postgres -c "CREATE DATABASE fraudwallet;"
echo "✅ Database created"
echo ""

# Step 4: Run schema
echo "📝 Step 5: Running database schema..."
docker exec -i fraudwallet-postgres-dev psql -U postgres -d fraudwallet < shared/database/schema.sql
echo "✅ Schema applied"
echo ""

# Step 5: Run updated seed data
echo "📝 Step 6: Running updated seed data..."
docker exec -i fraudwallet-postgres-dev psql -U postgres -d fraudwallet < shared/database/seed.sql
echo "✅ Seed data loaded"
echo ""

# Step 6: Verify users
echo "📝 Step 7: Verifying seeded users..."
echo ""
docker exec fraudwallet-postgres-dev psql -U postgres -d fraudwallet -c "SELECT id, email, full_name, account_id, wallet_balance FROM users;"
echo ""

# Step 7: Test login
echo "📝 Step 8: Testing login with john@test.com..."
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"Test1234!"}')

echo "Response: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Login successful!"
  echo ""
  echo "=============================================="
  echo "🎉 DATABASE FIXED!"
  echo "=============================================="
  echo ""
  echo "Test users are now ready with password: Test1234!"
  echo "  - john@test.com / Test1234!"
  echo "  - jane@test.com / Test1234!"
  echo "  - bob@test.com / Test1234!"
  echo "  - alice@test.com / Test1234!"
else
  echo "⚠️  Login test failed. Response:"
  echo "$RESPONSE"
fi
