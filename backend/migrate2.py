import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_yNkmWL02cSEu@ep-rapid-smoke-ax9b9xmt.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE ordenes ADD COLUMN fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    print("Column 'fecha' added successfully!")
except Exception as e:
    print("Error:", e)
