@echo off
REM kppdf-ai-analyst - запуск dev (обертка для start.ps1)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
