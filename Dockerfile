# ============================================
# ZEUS CRM PRO - Docker Configuration
# ============================================
FROM node:20-alpine

# Security: non-root user
RUN addgroup -S zeus && adduser -S zeus -G zeus

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy app source
COPY . .

# Create logs directory
RUN mkdir -p logs && chown -R zeus:zeus /app

USER zeus

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "server/index.js"]
