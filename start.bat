@echo off
setlocal
cd /d "%~dp0"

set "PORT=8080"
set "URL=http://localhost:%PORT%"

if not exist ".\node_modules\pdf-lib\dist\pdf-lib.min.js" (
  echo 必要ライブラリを準備します...
  where npm >nul 2>nul
  if not %ERRORLEVEL%==0 (
    echo npm が見つかりません。Node.js をインストールしてください。
    echo https://nodejs.org/
    pause
    exit /b 1
  )
  npm install
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Python でサーバーを起動します...
  echo URL: %URL%
  start "" "%URL%"
  python -m http.server %PORT%
  if errorlevel 1 (
    echo.
    echo サーバー起動に失敗しました。
    echo すでに同じポートが使われている可能性があります。
    echo ブラウザで %URL% を手動で開いて確認してください。
    pause
  )
  exit /b %ERRORLEVEL%
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  echo py ランチャーでサーバーを起動します...
  echo URL: %URL%
  start "" "%URL%"
  py -m http.server %PORT%
  if errorlevel 1 (
    echo.
    echo サーバー起動に失敗しました。
    echo すでに同じポートが使われている可能性があります。
    echo ブラウザで %URL% を手動で開いて確認してください。
    pause
  )
  exit /b %ERRORLEVEL%
)

echo Python が見つかりません。
echo https://www.python.org/downloads/ からインストールしてください。
pause
