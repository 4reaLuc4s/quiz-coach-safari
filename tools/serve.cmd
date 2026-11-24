@echo off
cd /d "%~dp0.."
echo Quiz Coach 本地预览: http://127.0.0.1:8788/tools/preview.html
echo 按 Ctrl+C 结束
python -m http.server 8788 --bind 127.0.0.1
