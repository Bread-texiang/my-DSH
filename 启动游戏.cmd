@echo off
setlocal
set "ROOT=%~dp0"
set "URL=file:///%ROOT:\=/%index.html"
set "PROFILE=%ROOT%.appdata"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --user-data-dir="%PROFILE%" --no-first-run --disable-background-mode --app="%URL%" --start-fullscreen
) else (
  start "" "%URL%"
)

endlocal
