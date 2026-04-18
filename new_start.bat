@echo off
cd /d "%~dp0"
echo Starting Nomation...
echo.
node scripts/start.js
if errorlevel 1 (
    echo.
    echo Something went wrong. See errors above.
)
pause
