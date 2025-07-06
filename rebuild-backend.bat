@echo off
echo ===============================================
echo   🔧 REBUILDING BACKEND WITH PLAYWRIGHT FIX
echo ===============================================
echo.

echo 🛑 Stopping backend container...
docker-compose stop backend

echo 🗑️ Removing backend container and image...
docker-compose rm -f backend
docker rmi saas_nomation-backend 2>nul

echo 🔨 Rebuilding backend image...
docker-compose build --no-cache backend

echo 🚀 Starting backend...
docker-compose up -d backend

echo.
echo ⏳ Waiting for backend to start...
timeout /t 15 /nobreak >nul

echo.
echo 🔍 Checking backend health...
docker-compose ps backend
docker-compose logs --tail 20 backend

echo.
echo ===============================================
echo   ✅ BACKEND REBUILD COMPLETE
echo ===============================================
echo.
echo 🌐 Test backend at: http://localhost:3002/health
echo.
pause