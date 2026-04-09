@echo off
chcp 65001 > nul
set TARGET=list.js

echo const fileList = [ > %TARGET%

for %%F in (*.js) do (
    if /I not "%%F"=="list.js" if /I not "%%F"=="app.js" (
        echo "%%~nF", >> %TARGET%
    )
)

echo ]; >> %TARGET%
