#!/bin/bash

echo "🔄 Switching from Microservices to Monolithic Setup"
echo "===================================================="
echo ""

# Step 1: Stop microservices
echo "📝 Step 1: Stopping microservices..."
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/services
docker compose -f docker-compose.dev.yml down
echo "✅ Microservices stopped"
echo ""

# Step 2: Start monolithic setup
echo "📝 Step 2: Starting monolithic setup..."
cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet
docker compose up -d
echo "✅ Monolithic services started"
echo ""

# Step 3: Wait for services to be ready
echo "📝 Step 3: Waiting for services to start (10 seconds)..."
sleep 10
echo "✅ Services should be ready"
echo ""

# Step 4: Check status
echo "📝 Step 4: Checking service status..."
docker compose ps
echo ""

echo "===================================================="
echo "🎉 ROLLBACK COMPLETE!"
echo "===================================================="
echo ""
echo "Your monolithic app should now be running on:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend: http://localhost:8080"
echo ""
echo "To view logs:"
echo "  docker compose logs -f"
