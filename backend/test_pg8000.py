import os
from sqlalchemy import create_engine
import ssl

url = "postgresql+pg8000://neondb_owner:npg_yNkmWL02cSEu@ep-rapid-smoke-ax9b9xmt.c-4.us-east-2.aws.neon.tech/neondb"
print("Connecting...")
try:
    ssl_context = ssl.create_default_context()
    engine = create_engine(url, connect_args={'ssl_context': ssl_context})
    connection = engine.connect()
    print("Success!")
except Exception as e:
    print("Error:", str(e))
