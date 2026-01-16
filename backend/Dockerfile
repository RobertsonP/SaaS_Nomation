# Backend Dockerfile for Nomation - Optimized Multi-Stage Build
FROM node:18-bullseye-slim AS base

# Install ONLY essential system dependencies for Playwright
# Reduced from 42 to 20 packages for smaller image size
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgbm1 \
    libxss1 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    openssl \
    libssl-dev \
    xvfb \
    xauth \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/*

# Set up virtual display for headless browser with frame capture
ENV DISPLAY=:99
ENV XVFB_DISPLAY=:99
ENV SCREEN_WIDTH=1280
ENV SCREEN_HEIGHT=720
ENV SCREEN_DEPTH=24

# Configure Playwright browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Development stage
FROM base AS development

# Install all dependencies including dev dependencies (using npm ci for deterministic builds)
RUN npm ci

# Copy and set executable permissions for startup script
COPY start-with-display.sh /usr/local/bin/start-with-display.sh
RUN chmod +x /usr/local/bin/start-with-display.sh

# Generate Prisma client with correct binary target (AFTER code copy)
RUN npx prisma generate

# Expose ports
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["/usr/local/bin/start-with-display.sh", "npm", "run", "dev"]

# Dependencies stage - separate layer for caching
FROM base AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage - optimized final image
FROM base AS production

WORKDIR /app

# Set NODE_ENV
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Copy production dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Generate Prisma client for production
RUN npx prisma generate

# Install Playwright browsers (required for test execution)
RUN npx playwright install chromium

# Copy startup script
COPY start-with-display.sh /usr/local/bin/start-with-display.sh
RUN chmod +x /usr/local/bin/start-with-display.sh

# Create non-root user
RUN addgroup --gid 1001 --system nodejs && \
    adduser --uid 1001 --system --ingroup nodejs nestjs
USER nestjs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application
CMD ["/usr/local/bin/start-with-display.sh", "node", "dist/main"]