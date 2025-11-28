FROM node:20-alpine

WORKDIR /app

# Copy shared dependencies
COPY services/shared /app/shared

# Copy package files
COPY services/wallet-service/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY services/wallet-service/src ./src
COPY services/wallet-service/.env.example ./.env

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start service
CMD ["node", "src/server.js"]
