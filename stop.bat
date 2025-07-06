@echo off
echo ===============================================
echo   🛑 STOPPING NOMATION PROJECT
echo ===============================================
echo.

echo 🔍 Checking running services...
docker-compose ps

echo.
echo 🛑 Stopping all Nomation services...
echo   - Frontend React App
echo   - Backend API
echo   - PostgreSQL Database  
echo   - Ollama AI Service
echo.

REM Stop all services including AI profile
docker-compose --profile ai down

echo.
echo 🧹 Cleaning up networks...
docker-compose down --remove-orphans

echo.
echo ===============================================
echo   ✅ NOMATION PROJECT STOPPED SUCCESSFULLY!
echo ===============================================
echo.
echo 💾 Note: Database data is preserved
echo 🚀 Restart with: start.bat
echo 🔄 Full restart: restart.bat
echo.
echo 📊 To view stopped containers: docker ps -a
echo 🗑️  To remove all data: docker-compose down -v
echo.
pause