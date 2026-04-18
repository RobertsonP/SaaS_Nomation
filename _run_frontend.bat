@echo off
title Nomation Frontend
cd /d "C:\SaaS_Nomation\frontend"
set VITE_API_URL=http://localhost:3002
echo.
echo   Nomation Frontend
echo.
npm run dev
