#!/bin/bash

# Script to update hardcoded localhost:8080 to use environment variable

cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/frontend/src

echo "Updating API URLs to use environment variable..."

# Files to update
files=(
  "components/dashboard-tab.tsx"
  "components/payment-tab.tsx"
  "components/profile-tab.tsx"
  "components/splitpay-tab.tsx"
  "app/login/page.tsx"
  "app/signup/page.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."

    # Add API_URL constant at the top if not exists
    if ! grep -q "const API_URL" "$file"; then
      # Add after imports, before first function/component
      sed -i '/^import/a\\n// API URL configuration\nconst API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"' "$file"
    fi

    # Replace all http://localhost:8080 with ${API_URL}
    sed -i 's|"http://localhost:8080/|`${API_URL}/|g' "$file"
    sed -i "s|'http://localhost:8080/|\`\${API_URL}/|g" "$file"

    echo "✅ Updated $file"
  else
    echo "⚠️  File not found: $file"
  fi
done

echo ""
echo "========================================  "
echo "✅ All files updated!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Restart the frontend server (Ctrl+C then npm run dev)"
echo "2. If using WSL, you can now change API_URL in .env.local if needed"
