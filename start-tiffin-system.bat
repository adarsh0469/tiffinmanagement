@echo off
title Tiffin Centre Billing & Dispatch System
echo ===================================================
echo     🍱 Tiffin Centre Billing & Dispatch System
echo ===================================================
echo Cleaning up any old background node instances...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo Starting Backend API and Frontend Application...
echo.
npm run dev
pause
