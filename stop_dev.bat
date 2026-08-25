@echo off
title InterCity Property Chatbot - Stop Dev Servers
echo ============================================
echo  InterCity Property Chatbot - Stopping Dev Servers
echo ============================================
echo.

REM --- Stop Backend (port 8000) ---
echo Stopping Backend (port 8000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo   Killing PID %%a
    taskkill /PID %%a /T /F >NUL 2>&1
)

REM --- Stop Frontend (port 3000) ---
echo Stopping Frontend (port 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo   Killing PID %%a
    taskkill /PID %%a /T /F >NUL 2>&1
)

echo.
echo All dev servers stopped.
echo.
pause