@echo off
REM fix_comparison.bat - Fix the comparison feature on Windows
REM This script seeds the database and creates BNS↔IPC mappings

echo.
echo ============================================================
echo FIXING COMPARISON FEATURE - Running Database Setup
echo ============================================================
echo.

cd /d "%~dp0"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python first.
    pause
    exit /b 1
)

REM Run the setup script
echo [INFO] Starting database setup - this may take a minute...
echo.

python setup_comparison.py

if errorlevel 1 (
    echo.
    echo [ERROR] Setup failed. Please check the errors above.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo NEXT STEPS:
echo ============================================================
echo.
echo 1. Make sure MongoDB is running:
echo    - If using Docker: docker-compose up -d
echo    - If using Windows: Run setup-mongodb.bat
echo.
echo 2. Start the backend:
echo    python main.py
echo.
echo 3. In a new terminal, start the frontend:
echo    cd frontend
echo    npm run dev
echo.
echo 4. Go to http://localhost:3000/compare
echo    Search for "Murder", "Theft", "Rape" etc.
echo    The comparison results should now appear!
echo.
echo ============================================================

pause
