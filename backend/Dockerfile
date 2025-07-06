# Backend Dockerfile for Nomation
FROM node:18-bullseye-slim AS base

# Install system dependencies for Playwright and Prisma
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Configure Playwright browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Development stage
FROM base AS development

# Install all dependencies including dev dependencies
RUN npm install

# Generate Prisma client with correct binary target
RUN npx prisma generate

# Install Playwright dependencies and browsers
RUN npx playwright install-deps chromium
RUN npx playwright install chromium

# Verify browser installation and location
RUN npx playwright --version
RUN ls -la /opt/playwright/ || echo "Playwright directory not found"
RUN find /opt -name "*chrome*" -type f 2>/dev/null || echo "Chrome executables not found"

# Copy source code
COPY . .

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production

# Set NODE_ENV
ENV NODE_ENV=production

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Copy built application
COPY dist ./dist
COPY prisma ./prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
USER nestjs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application
CMD ["npm", "start"]