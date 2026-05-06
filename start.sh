#!/bin/bash
echo "============================================"
echo "  MailFlow - Starting..."
echo "============================================"

# Virtual environment banao agar nahi hai
if [ ! -d "venv" ]; then
    echo "Virtual environment bana raha hoon..."
    python3 -m venv venv
fi

# Activate karo
source venv/bin/activate

# Dependencies install karo
echo "Dependencies check ho rahi hain..."
pip install -r requirements.txt --quiet

# App start karo
echo ""
echo "============================================"
echo "  App chal rahi hai!"
echo "  Browser mein kholo: http://localhost:5000"
echo "  Band karne ke liye: Ctrl+C dabao"
echo "============================================"
echo ""
python app.py
