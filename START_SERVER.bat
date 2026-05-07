@echo off
echo ========================================
echo PATHFIT Tracking System - Server Starter
echo ========================================
echo.

REM Check if PHP is installed
where php >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PHP is not installed or not in PATH!
    echo.
    echo Please install PHP first:
    echo   Option 1: Download XAMPP from https://www.apachefriends.org/
    echo   Option 2: Download PHP from https://windows.php.net/download/
    echo.
    echo After installation, run this script again.
    echo.
    pause
    exit /b 1
)

REM Display PHP version
echo [OK] PHP is installed:
php --version | findstr /C:"PHP"
echo.

REM Check if config.php has been configured
findstr /C:"YOUR_PROJECT_ID" config.php >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [WARNING] config.php has not been configured yet!
    echo.
    echo Please edit config.php and add your Supabase credentials:
    echo   1. SUPABASE_URL
    echo   2. SUPABASE_ANON_KEY
    echo   3. SUPABASE_SERVICE_KEY
    echo.
    echo See README.md for detailed instructions.
    echo.
    pause
)

REM Start PHP built-in server
echo Starting PHP development server...
echo.
echo Server running at: http://localhost:8000
echo.
echo Open your browser and go to:
echo   http://localhost:8000/login.php
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

php -S localhost:8000

pause
