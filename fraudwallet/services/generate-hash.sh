#!/bin/bash

# Generate bcrypt hash for Test1234! using the auth-service container

echo "🔐 Generating bcrypt hash for password: Test1234!"
echo ""

HASH=$(docker exec fraudwallet-auth-service node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Test1234!', 10).then(hash => console.log(hash))")

echo "✅ Generated hash:"
echo "$HASH"
echo ""
echo "📝 Use this hash to replace '\$2b\$10\$YourBcryptHashHere' in seed.sql"
