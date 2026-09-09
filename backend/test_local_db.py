import os
# Force to use Neon DB locally
os.environ['DATABASE_URL'] = "postgresql://neondb_owner:npg_yNkmWL02cSEu@ep-rapid-smoke-ax9b9xmt.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
from app import app
with app.app_context():
    # Attempt to fetch products just like the API does
    from app import Producto
    try:
        productos = Producto.query.all()
        print("Success! Products:", productos)
    except Exception as e:
        import traceback
        traceback.print_exc()
