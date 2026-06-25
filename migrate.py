from app import app, db
from sqlalchemy import text

with app.app_context():
    try:
        db.session.execute(text('ALTER TABLE campaign ADD COLUMN send_limit INTEGER DEFAULT 0;'))
        db.session.commit()
        print('Migration successful')
    except Exception as e:
        print(f"Error: {e}")
