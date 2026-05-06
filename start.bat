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

echo Installing dependencies...
pip install Flask==3.0.0 Flask-SQLAlchemy==3.1.1 Werkzeug==3.0.1 gunicorn==21.2.0 python-dotenv==1.0.0 --quiet

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
