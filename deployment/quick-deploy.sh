#!/bin/bash
#
# Quick Deploy Script (no rebuild, just restart)
# Use this for quick restarts without rebuilding images
#
set -e

APP_DIR="$HOME/app/fraudwallet"

echo "⚡ Quick deploying FraudWallet..."

cd $APP_DIR

# Pull latest code
git pull origin main

# Restart services without rebuilding
docker-compose -f docker-compose.microservices.yml restart

echo "✅ Services restarted!"
docker-compose -f docker-compose.microservices.yml ps
