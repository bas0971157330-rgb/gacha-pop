@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo ไม่พบ npm ในเครื่องนี้
  echo กรุณาติดตั้ง Node.js ก่อน แล้วลองรันไฟล์นี้อีกครั้ง
  pause
  exit /b 1
)

echo.
echo กำลัง build เว็บ Gacha Pop...
call npm run build
if errorlevel 1 (
  echo.
  echo Build ไม่สำเร็จ กรุณาแก้ error ก่อน deploy
  pause
  exit /b 1
)

echo.
echo ตรวจสอบการเข้าสู่ระบบ Vercel...
call npx --yes vercel@latest whoami >nul 2>nul
if errorlevel 1 (
  echo.
  echo ยังไม่ได้เข้าสู่ระบบ Vercel
  call npx --yes vercel@latest login
  if errorlevel 1 (
    echo.
    echo เข้าสู่ระบบ Vercel ไม่สำเร็จ
    pause
    exit /b 1
  )
)

echo.
echo กำลัง deploy ขึ้น Vercel production...
call npx --yes vercel@latest --prod
if errorlevel 1 (
  echo.
  echo Deploy ไม่สำเร็จ
  pause
  exit /b 1
)

echo.
echo Deploy สำเร็จแล้ว
pause
