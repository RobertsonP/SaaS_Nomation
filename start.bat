@echo off
echo ===============================================
echo   🚀 STARTING NOMATION PROJECT
echo ===============================================
echo.

echo 📋 Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed or not running!
    echo Please install Docker Desktop and try again.
    pause
    exit /b 1
)

echo ✅ Docker is available
echo.

echo 🐳 Starting Nomation services...
echo   - PostgreSQL Database
echo   - Backend API (with Playwright)
echo   - Frontend React App  
echo   - Ollama AI Service
echo.

REM Start all services with AI profile
docker-compose --profile ai up -d

echo.
echo ⏳ Waiting for services to initialize...
timeout /t 10 /nobreak >nul

echo.
echo 🤖 Setting up Ollama AI model...
echo   Pulling llama3.2:latest model (this may take a moment on first run)...
docker exec nomation-ollama ollama pull llama3.2:latest 2>nul

echo.
echo 🔍 Checking service status...
docker-compose ps

echo.
echo ===============================================
echo   ✅ NOMATION PROJECT STARTED SUCCESSFULLY!
echo ===============================================
echo.
echo 🌐 Access your application:
echo   Frontend:      http://localhost:3001
echo   Backend API:   http://localhost:3002
echo   Database Admin: http://localhost:5555 (if enabled)
echo.
echo 📝 Default login credentials:
echo   Email:    test@test.com
echo   Password: test
echo.
echo 📊 View logs:    docker-compose logs -f [service-name]
echo 🛑 Stop project: run stop.bat
echo.
pause