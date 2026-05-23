@echo off
echo ============================================
echo   MailFlow - Starting...
echo ============================================

python --version > nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found! Install from python.org
    pause
    exit
)

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate

echo Installing dependencies from requirements.txt...
pip install -r requirements.txt --quiet

echo Setting up environment...
set SECRET_KEY=mailflow-super-secret-2024-xK9mP2nQ
set GOOGLE_CLIENT_ID=692871759210-mrjr5ib5mvti7mnue5339au83ihvsrok.apps.googleusercontent.com
set GOOGLE_CLIENT_SECRET=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
set APP_BASE_URL=http://localhost:5000

echo.
echo ============================================
echo   App is running!
echo   Open in browser: http://localhost:5000
echo   To stop: Press Ctrl+C
echo ============================================
echo.
python app.py

pause
