@echo off
cd /d "%~dp0.."
if not exist "userscript" mkdir "userscript"
copy /b "tools\userscript-header.txt"+"Extension\Resources\content.js" "userscript\quiz-coach.user.js" >nul
echo Generated: userscript\quiz-coach.user.js
