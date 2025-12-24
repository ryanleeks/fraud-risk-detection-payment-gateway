#!/bin/bash
#
# Deployment Script for FraudWallet Microservices
# Run this to deploy or update the application
#
set -e

APP_DIR="$HOME/app/fraudwallet"

echo "🚀 Deploying FraudWallet Microservices..."

# Navigate to app directory
cd $APP_DIR

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.microservices.yml down

# Remove old images (optional - saves space)
echo "🗑️  Removing old images..."
docker image prune -f

# Build new images
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.microservices.yml build

# Start services
echo "▶️  Starting services..."
docker-compose -f docker-compose.microservices.yml up -d

# Show logs
echo "📋 Showing logs (Ctrl+C to exit, services will keep running)..."
docker-compose -f docker-compose.microservices.yml logs -f
