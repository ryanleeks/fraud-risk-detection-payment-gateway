#!/bin/bash
#
# SSL Certificate Setup Script
# Sets up Let's Encrypt SSL certificate for your domain
#
set -e

if [ -z "$1" ]; then
  echo "Usage: ./ssl-setup.sh yourdomain.com"
  exit 1
fi

DOMAIN=$1
APP_DIR="$HOME/app/fraudwallet"

echo "🔒 Setting up SSL for $DOMAIN..."

# Stop nginx temporarily
echo "🛑 Stopping nginx..."
docker-compose -f $APP_DIR/docker-compose.microservices.yml stop nginx

# Get certificate
echo "📜 Obtaining SSL certificate..."
sudo certbot certonly --standalone -d $DOMAIN

# Copy certificates
echo "📋 Copying certificates..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $APP_DIR/nginx/ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $APP_DIR/nginx/ssl/

# Set permissions
sudo chown $USER:$USER $APP_DIR/nginx/ssl/*.pem

# Update nginx config for HTTPS
echo "🔧 Updating nginx configuration..."
sed -i "s/localhost/$DOMAIN/g" $APP_DIR/nginx/nginx.conf

# Restart nginx
echo "▶️  Restarting nginx with SSL..."
docker-compose -f $APP_DIR/docker-compose.microservices.yml up -d nginx

echo "✅ SSL setup complete!"
echo "🌐 Your site should now be accessible at https://$DOMAIN"
