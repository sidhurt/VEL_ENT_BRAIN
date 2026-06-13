@echo off
title Unified Brain Launcher
echo ===================================================
echo     Starting Unified Brain Infrastructure
echo ===================================================
echo.

echo [1/3] Starting Neo4j Graph Database via Docker...
docker compose up -d

echo.
echo Waiting 15 seconds for Neo4j to initialize...
timeout /t 15 /nobreak > NUL

echo.
echo [2/3] Launching Backend Services...
start "Unified Brain Backend" cmd /c "cd backend && echo Installing Backend Dependencies... && npm install && echo Seeding Database... && npm run seed && echo Starting Backend... && npm run dev"

echo.
echo [3/3] Launching Frontend Interface...
start "Unified Brain Frontend" cmd /c "cd frontend && echo Installing Frontend Dependencies... && npm install && echo Starting Frontend... && npm run dev"

echo.
echo ===================================================
echo     Startup Initiated Successfully!
echo ===================================================
echo.
echo - Frontend will be available at: http://localhost:5173
echo - Backend API is running on:     http://localhost:3000
echo - Neo4j Browser is running on:   http://localhost:7474
echo.
echo Two new terminal windows have been opened for the backend and frontend.
echo You can safely close this launcher window.
echo.
pause
