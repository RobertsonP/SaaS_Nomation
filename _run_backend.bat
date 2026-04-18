@echo off
title Nomation Backend
cd /d "C:\SaaS_Nomation\backend"
set DATABASE_URL=postgresql://nomation_user:nomation_password@localhost:5432/nomation
set REDIS_HOST=localhost
set REDIS_PORT=6379
set REDIS_PASSWORD=
set JWT_SECRET=nomation-secret-key-2024-ultra-secure-development-only
set PORT=3002
set CORS_ORIGIN=http://localhost:3001
set NODE_ENV=development
set PLAYWRIGHT_BROWSERS_PATH=0
echo.
echo   Nomation Backend
echo.
npm run dev
