#!/bin/bash

# FraudWallet Microservices Setup Checker
# This script verifies your environment is properly configured

echo "🔍 FraudWallet Microservices Setup Checker"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "   Run: cp .env.example .env"
    echo "   Then edit .env with your actual values"
    exit 1
fi

echo "✅ .env file found"

# Check Stripe keys
source .env

ERRORS=0

if [[ "$STRIPE_SECRET_KEY" == *"YOUR_STRIPE"* ]] || [[ "$STRIPE_SECRET_KEY" == "sk_test_your_stripe_secret_key_here" ]]; then
    echo "❌ STRIPE_SECRET_KEY not configured"
    echo "   Get it from: https://dashboard.stripe.com/test/apikeys"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ STRIPE_SECRET_KEY configured"
fi

if [[ "$STRIPE_WEBHOOK_SECRET" == *"YOUR_WEBHOOK"* ]] || [[ "$STRIPE_WEBHOOK_SECRET" == "whsec_your_webhook_secret_here" ]]; then
    echo "⚠️  STRIPE_WEBHOOK_SECRET not configured (will set up during Stripe webhook setup)"
else
    echo "✅ STRIPE_WEBHOOK_SECRET configured"
fi

echo ""

if [ $ERRORS -gt 0 ]; then
    echo "❌ Setup incomplete! Please fix the errors above."
    echo ""
    echo "Quick Setup:"
    echo "1. Go to https://dashboard.stripe.com/test/apikeys"
    echo "2. Copy your 'Secret key' (starts with sk_test_)"
    echo "3. Edit .env and replace STRIPE_SECRET_KEY"
    echo "4. Run 'stripe listen --forward-to http://localhost:8080/api/webhook/stripe'"
    echo "5. Copy the webhook secret (starts with whsec_) and update STRIPE_WEBHOOK_SECRET"
    exit 1
else
    echo "✅ Basic setup looks good!"
    echo ""
    echo "Next steps:"
    echo "1. Run: docker compose -f docker-compose.dev.yml up --build"
    echo "2. In another terminal, run: stripe listen --forward-to http://localhost:8080/api/webhook/stripe"
    echo "3. Update STRIPE_WEBHOOK_SECRET in .env with the webhook secret"
    echo "4. Restart wallet service: docker compose -f docker-compose.dev.yml restart wallet-service"
    echo ""
    echo "🚀 Ready to start!"
fi
