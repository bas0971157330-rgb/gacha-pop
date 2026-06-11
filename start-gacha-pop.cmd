@echo off
cd /d "%~dp0"
echo Starting Gacha Pop at http://localhost:3000
echo Mobile/LAN URL example: http://192.168.1.106:3000
echo Keep this window open while using the website.
"C:\Users\bas09\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "node_modules\next\dist\bin\next" dev --webpack -H 0.0.0.0 -p 3000
pause
