FROM node:20-alpine
WORKDIR /app
COPY services/shared /shared
COPY services/splitpay-service/package*.json ./
RUN npm ci --only=production
COPY services/splitpay-service/src ./src
COPY services/splitpay-service/.env.example ./.env
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "src/server.js"]
