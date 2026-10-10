@echo off
REM One-click launcher for Echo. Double-click this file.
REM It starts the API server in its own window, then Metro for the phone.
REM (Postgres runs in Docker; start it once with: docker compose up -d)

echo Starting Echo API server in a new window...
start "Echo API server" cmd /k "cd /d "%~dp0apps\server" && node dist\index.js"

echo Starting Metro (Expo) for your phone...
cd /d "%~dp0apps\mobile"
call npx expo start --lan
