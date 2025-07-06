@echo off
echo ===============================================
echo   🔄 COMPLETELY RESTARTING NOMATION PROJECT
echo ===============================================
echo.

echo ⚠️  WARNING: This will completely rebuild and restart the project
echo    - All containers will be stopped and removed
echo    - Database data will be preserved
echo    - Docker images will be rebuilt
echo    - Fresh application start
echo.
set /p confirm="Continue? (y/N): "
if /i not "%confirm%"=="y" (
    echo Operation cancelled.
    pause
    exit /b 0
)

echo.
echo 🛑 Stopping all services...
docker-compose --profile ai down

echo.
echo 🧹 Cleaning up containers and networks...
docker-compose --profile ai down --remove-orphans

echo.
echo 🔨 Rebuilding application images...
docker-compose build --no-cache backend frontend

echo.
echo 🚀 Starting services with fresh build...
docker-compose --profile ai up -d

echo.
echo ⏳ Waiting for services to initialize...
timeout /t 15 /nobreak >nul

echo.
echo 🤖 Setting up Ollama AI model...
docker exec nomation-ollama ollama pull llama3.2:latest 2>nul

echo.
echo 🔧 Applying database migrations...
docker-compose exec backend npx prisma db push 2>nul

echo.
echo 🔍 Final service status...
docker-compose ps

echo.
echo ===============================================
echo   ✅ NOMATION PROJECT RESTARTED SUCCESSFULLY!
echo ===============================================
echo.
echo 🌐 Access your application:
echo   Frontend:      http://localhost:3001
echo   Backend API:   http://localhost:3002
echo.
echo 💡 Tip: If issues persist, check logs with:
echo    docker-compose logs -f [service-name]
echo.
pause