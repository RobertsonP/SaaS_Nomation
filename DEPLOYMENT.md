# Production Deployment Guide

## Prerequisites

### System Requirements
- **Server**: Ubuntu 20.04+ or Debian 11+ (recommended)
- **Docker**: Version 24.0+ with Docker Compose V2
- **Memory**: Minimum 4GB RAM (8GB recommended for production)
- **Storage**: Minimum 20GB available disk space
- **Domain**: DNS records configured pointing to server IP
- **SSL Certificate**: Let's Encrypt recommended (via Certbot)

### Required Software
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose (if not included)
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## Production Environment Setup

### Step 1: Environment Variables

Create production environment file `.env` from template:

```bash
cp .env.example .env
```

Edit `.env` with production values:

```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 64)
REDIS_PASSWORD=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Update .env file
cat > .env << EOF
# Environment
NODE_ENV=production

# Database (PostgreSQL)
POSTGRES_USER=nomation_prod
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=nomation_production
DATABASE_URL=postgresql://nomation_prod:${POSTGRES_PASSWORD}@postgres:5432/nomation_production

# JWT Authentication
JWT_SECRET=${JWT_SECRET}

# Redis (Job Queue)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# Backend API
PORT=3002
CORS_ORIGIN=https://yourdomain.com

# Frontend
VITE_API_URL=https://api.yourdomain.com

# Playwright
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false

# Prisma
PRISMA_CLI_BINARY_TARGETS=debian-openssl-1.1.x,debian-openssl-3.0.x
EOF
```

**⚠️ CRITICAL**: Immediately add `.env` to `.gitignore` to prevent accidental commits.

---

### Step 2: Deploy Application

#### Pull Latest Code
```bash
# Clone repository (if first deployment)
git clone https://github.com/yourusername/nomation.git
cd nomation

# Or pull latest changes
git pull origin main
```

#### Build and Start Services
```bash
# Build Docker images
docker compose build

# Start all services
docker compose up -d

# Verify all containers are running
docker compose ps
```

Expected output:
```
NAME                        STATUS          PORTS
nomation-backend           Up 30 seconds   0.0.0.0:3002->3002/tcp
nomation-frontend          Up 30 seconds   0.0.0.0:3001->3001/tcp
nomation-postgres          Up 30 seconds   0.0.0.0:5432->5432/tcp
nomation-redis             Up 30 seconds   0.0.0.0:6379->6379/tcp
```

#### Run Database Migrations
```bash
# Apply all pending migrations
docker compose exec backend npx prisma migrate deploy

# Verify database schema
docker compose exec backend npx prisma db pull
```

---

### Step 3: Configure Nginx Reverse Proxy

Install Nginx:
```bash
sudo apt-get update
sudo apt-get install nginx
```

Create Nginx configuration for API:

**File**: `/etc/nginx/sites-available/nomation-api`
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long-running test executions
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
```

Create Nginx configuration for Frontend:

**File**: `/etc/nginx/sites-available/nomation-frontend`
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable sites and restart Nginx:
```bash
# Create symbolic links
sudo ln -s /etc/nginx/sites-available/nomation-api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/nomation-frontend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

### Step 4: Enable SSL with Let's Encrypt

Install Certbot:
```bash
sudo apt-get install certbot python3-certbot-nginx
```

Obtain SSL certificates:
```bash
# For API subdomain
sudo certbot --nginx -d api.yourdomain.com

# For frontend domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically:
- Obtain certificates
- Update Nginx configuration
- Set up automatic renewal

Verify auto-renewal:
```bash
sudo certbot renew --dry-run
```

---

## Verification

### Health Checks

**Backend API**:
```bash
curl https://api.yourdomain.com/health

# Expected response:
# {"status":"ok","timestamp":"2025-12-15T...","database":"connected"}
```

**Frontend**:
```bash
curl https://yourdomain.com

# Expected: HTML response with <title>Nomation</title>
```

### Security Verification

**Rate Limiting** (should return 429 after 100 requests/minute):
```bash
for i in {1..150}; do curl -s https://api.yourdomain.com/health & done
```

**Security Headers**:
```bash
curl -I https://api.yourdomain.com/health | grep -E "X-Frame-Options|X-Content-Type-Options"

# Expected:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
```

**Database Indexes**:
```bash
docker compose exec postgres psql -U nomation_prod -d nomation_production -c "\\di" | grep idx

# Expected: 19+ indexes listed
```

---

## Monitoring & Maintenance

### View Logs

**All services**:
```bash
docker compose logs -f
```

**Specific service**:
```bash
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f redis
```

**Nginx logs**:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Database Backup

**Manual backup**:
```bash
# Create backup directory
mkdir -p backups

# Backup database
docker compose exec postgres pg_dump -U nomation_prod nomation_production > backups/backup-$(date +%Y%m%d).sql
```

**Automated daily backups** (via cron):
```bash
# Add to crontab (crontab -e)
0 2 * * * cd /path/to/nomation && docker compose exec postgres pg_dump -U nomation_prod nomation_production > backups/backup-$(date +\%Y\%m\%d).sql
```

### Restore from Backup

```bash
# Stop backend to prevent connections
docker compose stop backend

# Restore database
docker compose exec -T postgres psql -U nomation_prod nomation_production < backups/backup-20251215.sql

# Restart backend
docker compose start backend
```

---

## Updating the Application

### Pull and Deploy Updates

```bash
# Pull latest code
git pull origin main

# Rebuild images (if Dockerfile changed)
docker compose build

# Restart services
docker compose down
docker compose up -d

# Run any new migrations
docker compose exec backend npx prisma migrate deploy

# Verify health
curl https://api.yourdomain.com/health
```

### Zero-Downtime Updates (Blue-Green Deployment)

For production systems requiring zero downtime:

1. **Start new version alongside old**:
   ```bash
   docker compose -p nomation-blue up -d
   ```

2. **Update Nginx to point to new version**
3. **Stop old version**:
   ```bash
   docker compose -p nomation-green down
   ```

---

## Scaling Considerations

### Horizontal Scaling (Multiple Servers)

**Database**: Use managed PostgreSQL (AWS RDS, Google Cloud SQL)
**Redis**: Use managed Redis (AWS ElastiCache, Redis Cloud)
**File Storage**: Use S3/MinIO for video recordings
**Load Balancer**: Nginx or cloud provider load balancer

### Vertical Scaling (Single Server)

**Increase Docker resources** in `/etc/docker/daemon.json`:
```json
{
  "default-shards": 2,
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 5
}
```

**Increase Postgres memory** via docker-compose.yml:
```yaml
postgres:
  environment:
    - POSTGRES_SHARED_BUFFERS=256MB
    - POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
```

---

## Troubleshooting

### Backend Not Starting

**Check logs**:
```bash
docker compose logs backend
```

**Common issues**:
- Database connection failed → Verify DATABASE_URL
- Redis connection failed → Verify REDIS_HOST and REDIS_PASSWORD
- Prisma migration error → Run `npx prisma migrate deploy`

### High Memory Usage

**Check container stats**:
```bash
docker stats
```

**Limit backend memory**:
```yaml
backend:
  deploy:
    resources:
      limits:
        memory: 2G
```

### Rate Limiting Too Strict

Adjust limits in `backend/src/app.module.ts`:
```typescript
ThrottlerModule.forRoot([{
  ttl: 60000,
  limit: 200, // Increase from 100
}])
```

Rebuild and redeploy.

---

## Security Best Practices

✅ **DO**:
- Use environment variables for all secrets
- Enable SSL/TLS (HTTPS only)
- Keep Docker images updated
- Run regular security audits (`npm audit`)
- Use firewall (ufw) to limit port access
- Enable automatic security updates
- Backup database daily
- Monitor logs for suspicious activity

❌ **DON'T**:
- Commit `.env` files to version control
- Expose database port (5432) publicly
- Use default passwords
- Run containers as root in production
- Disable security headers
- Skip SSL certificate validation

---

## Performance Optimization

### Database Query Optimization

All foreign keys have indexes (19 total). Monitor slow queries:

```bash
docker compose exec postgres psql -U nomation_prod -d nomation_production -c "
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"
```

### Redis Memory Optimization

Set max memory policy:
```yaml
redis:
  command: >
    redis-server
    --appendonly yes
    --requirepass ${REDIS_PASSWORD}
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
```

---

## Support & Contacts

- **Documentation**: https://docs.nomation.dev
- **Issues**: https://github.com/yourusername/nomation/issues
- **Email**: support@nomation.dev

---

**Last Updated**: December 15, 2025
**Version**: 1.0.0 (C1.4 Production Release)
