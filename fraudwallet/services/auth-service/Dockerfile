FROM node:20-alpine

WORKDIR /app

# Copy shared dependencies first
COPY services/shared /app/shared

# Copy service package files
COPY services/auth-service/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy service source code
COPY services/auth-service/src ./src
COPY services/auth-service/.env.example ./.env

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start service
CMD ["node", "src/server.js"]
