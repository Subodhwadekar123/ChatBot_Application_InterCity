@echo off
title InterCity Property Chatbot - Dev Launcher
echo ============================================
echo  InterCity Property Chatbot - Starting Dev Servers
echo ============================================
echo.

cd /d "%~dp0"

REM --- Start Backend in its own window ---
echo Starting Backend (http://127.0.0.1:8000)...
start "AI-Data-Analyst-Backend" cmd /k "cd /d "%~dp0" && python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"

REM --- Start Frontend in its own window ---
echo Starting Frontend (http://localhost:3000)...
start "AI-Data-Analyst-Frontend" cmd /k "cd /d "%~dp0" && npm run frontend"

echo.
echo Both servers are starting in separate windows.
echo   Backend  : http://127.0.0.1:8000
echo   Frontend : http://localhost:3000
echo.
echo Keep those windows open while developing.
echo To stop everything, run stop_dev.bat
echo.
pause