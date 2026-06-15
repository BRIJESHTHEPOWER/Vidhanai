@echo off
REM MongoDB Setup for Windows - AI Legal System

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  MongoDB Setup for AI Legal System (Windows)                   ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Check if MongoDB is installed
where mongod >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ MongoDB is not installed on this system.
    echo.
    echo 📦 INSTALLATION OPTIONS:
    echo.
    echo 1. Using Chocolatey (Recommended):
    echo    choco install mongodb-community
    echo.
    echo 2. Download Installer:
    echo    https://www.mongodb.com/try/download/community
    echo.
    echo 3. Using Docker (Easiest):
    echo    docker run -d -p 27017:27017 --name mongodb-legal mongo:latest
    echo.
    echo 4. Download and Extract:
    echo    https://www.mongodb.com/try/download/community
    echo    Extract to C:\Program Files\MongoDB
    echo.
    pause
    exit /b 1
)

echo ✓ MongoDB found
echo.
echo 🚀 Starting MongoDB...
echo.

REM Try to start MongoDB service first
net start MongoDB 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ MongoDB service started
    timeout /t 2
) else (
    REM Start mongod directly
    mongod.exe --logpath "%TEMP%\mongodb.log" &
    timeout /t 3
)

REM Check if MongoDB is running by connecting
mongosh --eval "db.adminCommand('ping')" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ MongoDB is running on mongodb://127.0.0.1:27017
    echo.
    echo 📋 Next Steps:
    echo  1. Install Python dependencies:  pip install -r requirements.txt
    echo  2. Start the backend:            python main.py
    echo  3. In another terminal, start frontend:  cd ..\frontend ^&^& npm run dev
    echo.
    pause
    exit /b 0
) else (
    echo ❌ MongoDB failed to connect
    echo.
    echo 💡 Troubleshooting:
    echo  - Make sure MongoDB is installed correctly
    echo  - Check if port 27017 is available
    echo  - Try starting MongoDB manually:  mongod.exe
    echo.
    pause
    exit /b 1
)
