@echo off
title Hoa Dang Live
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Chua cai Node.js. Tai ban LTS tai https://nodejs.org roi chay lai file nay.
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo  Lan dau chay: dang cai thu vien, doi 1-2 phut...
  call npm install
  if errorlevel 1 (
    echo  [!] Cai thu vien that bai. Kiem tra mang roi chay lai.
    pause
    exit /b 1
  )
)

echo.
echo  Dang bat Hoa Dang Live... Dong cua so nay la tat app.
echo  Link cho TikTok LIVE Studio: http://lvh.me:3001/?view=stage  (1080 x 1920)
echo.
rem LIVE_MODE: sua code khong lam trang san khau tu tai lai giua buoi live
set LIVE_MODE=1
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3001"
call npm run start
pause
