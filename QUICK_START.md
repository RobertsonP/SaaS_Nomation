# Nomation — Quick Start Guide

## Hybrid Mode (Recommended)

Databases run in Docker. Application runs natively on your machine.

### Prerequisites
- Docker Desktop (for PostgreSQL and Redis)
- Node.js LTS (22+)
- Git for Windows

### One-Command Start
Double-click `new_start.bat` in the project root. It handles everything automatically.

### Manual Start
```bash
# Terminal 1: Start databases
docker compose -f docker-compose.dev.yml up -d

# Terminal 2: Start backend
cd backend
set DATABASE_URL=postgresql://nomation_user:nomation_password@localhost:5432/nomation
set REDIS_HOST=localhost
set REDIS_PORT=6379
set JWT_SECRET=nomation-secret-key-2024-ultra-secure-development-only
set PORT=3002
set CORS_ORIGIN=http://localhost:3001
npm run dev

# Terminal 3: Start frontend
cd frontend
set VITE_API_URL=http://localhost:3002
npm run dev
```

### URLs
- Frontend: http://localhost:3001
- Backend API: http://localhost:3002
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Stop
Run `new_stop.bat` or:
```bash
docker compose -f docker-compose.dev.yml down
# Then close the backend and frontend terminal windows
```

### First Time Setup
After cloning the repo:
```bash
cd backend && npm install
cd ../frontend && npm install
cd ../backend && npx playwright install chromium
```

---

## Full Docker Mode (Legacy)

Everything runs inside Docker containers.

```bash
docker compose up --build
```

### URLs
- Frontend: http://localhost:3001
- Backend API: http://localhost:3002
- Prisma Studio: http://localhost:5555 (with --profile tools)

### Stop
```bash
docker compose down
```
