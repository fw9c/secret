@echo off
setlocal
title Uwuifier installer
cd /d "%~dp0"

echo === Uwuifier for Vencord ===
echo.

where git >nul 2>nul || (echo [!] Git is not installed. Get it from https://git-scm.com/download/win then run this again. & pause & exit /b 1)
where node >nul 2>nul || (echo [!] Node.js is not installed. Get the LTS from https://nodejs.org then run this again. & pause & exit /b 1)

set "VC=%USERPROFILE%\Vencord"
set COREPACK_ENABLE_STRICT=0

if exist "%VC%\.git" (
    echo Updating Vencord source in %VC% ...
    git -C "%VC%" pull
) else (
    echo Downloading Vencord source to %VC% ...
    git clone --depth 1 https://github.com/Vendicated/Vencord.git "%VC%" || (echo [!] Clone failed. & pause & exit /b 1)
)

echo Copying the Uwuifier plugin ...
if not exist "%VC%\src\userplugins\uwuifier" mkdir "%VC%\src\userplugins\uwuifier"
copy /y "uwuifier\index.tsx" "%VC%\src\userplugins\uwuifier\index.tsx" >nul

cd /d "%VC%"
echo Installing dependencies (takes a minute) ...
call npx -y pnpm@11.9.0 install --frozen-lockfile || (echo [!] Install failed. & pause & exit /b 1)
echo Building ...
call npx -y pnpm@11.9.0 build || (echo [!] Build failed. & pause & exit /b 1)

echo.
echo Close Discord fully (right-click tray icon ^> Quit), then press any key.
echo The Vencord installer will open: pick your Discord and choose Install / Repair.
pause >nul
call npx -y pnpm@11.9.0 inject

echo.
echo Done! Open Discord ^> Settings ^> Plugins ^> search "Uwuifier" ^> turn it on.
echo Toggle it with the pink "uwu" button in the chat bar or Ctrl+Shift+U.
pause
