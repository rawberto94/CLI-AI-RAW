@echo off
REM ============================================
REM Contract Intelligence Platform - Quick Start
REM ============================================
REM Double-click this file to start the application

echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║   CONTRACT INTELLIGENCE PLATFORM                      ║
echo ║   Starting Application...                             ║
echo ╚═══════════════════════════════════════════════════════╝
echo.

REM Check if .env exists
if not exist ".env" (
    echo [ERROR] .env file not found!
    echo.
    echo Please follow these steps:
    echo 1. Copy .env.example to .env
    echo 2. Update OPENAI_API_KEY in .env
    echo 3. Generate secrets with: openssl rand -base64 32
    echo 4. Run this file again
    echo.
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo.
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting services...
echo.

REM Start with PowerShell script
powershell -ExecutionPolicy Bypass -File run.ps1 start

pause
