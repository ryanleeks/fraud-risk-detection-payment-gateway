#!/bin/bash
#
# EC2 Initial Setup Script
# Run this ONCE on a fresh Ubuntu EC2 instance
#
set -e

echo "🚀 Starting EC2 setup for FraudWallet Microservices..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
rm get-docker.sh

# Install Docker Compose
echo "📦 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# Install Certbot for SSL
echo "🔒 Installing Certbot for SSL..."
sudo apt install -y certbot

# Create directories
echo "📁 Creating directories..."
mkdir -p ~/fraudwallet
mkdir -p ~/fraudwallet/nginx/ssl
mkdir -p ~/fraudwallet/data

# Set permissions
sudo chown -R $USER:$USER ~/fraudwallet

echo "✅ EC2 setup complete!"
echo ""
echo "🔑 Next steps:"
echo "1. Clone your repository: git clone <your-repo-url> ~/app"
echo "2. Setup environment: cd ~/app/fraudwallet && cp .env.production.example .env.production"
echo "3. Edit .env.production with your actual values"
echo "4. Setup SSL: sudo certbot certonly --standalone -d yourdomain.com"
echo "5. Copy SSL certs: sudo cp /etc/letsencrypt/live/yourdomain.com/*.pem nginx/ssl/"
echo "6. Run deploy.sh to start the application"
echo ""
echo "⚠️  IMPORTANT: Logout and login again for Docker permissions to take effect!"
