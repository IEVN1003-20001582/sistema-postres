import os
from sqlalchemy import text
from app import app, db

os.environ['DATABASE_URL'] = "postgresql://neondb_owner:npg_yNkmWL02cSEu@ep-rapid-smoke-ax9b9xmt.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE ordenes ADD COLUMN nombre_cliente VARCHAR(100);"))
        db.session.commit()
        print("Column added successfully!")
    except Exception as e:
        print("Error or column already exists:", str(e))
