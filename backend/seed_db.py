import os
import sys

# Replace the SQLite DB URI with the Neon DB URI the user provided
os.environ['DATABASE_URL'] = "postgresql://neondb_owner:npg_yNkmWL02cSEu@ep-rapid-smoke-ax9b9xmt.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app import app, db, Negocio, Producto, Insumo, Receta, Orden, OrdenDetalle

with app.app_context():
    print("Dropping all tables...")
    db.drop_all()
    
    print("Creating all tables...")
    db.create_all()
    
    print("Seeding data...")
    negocio_default = Negocio(nombre="Postres Arcade")
    db.session.add(negocio_default)
    db.session.commit()
    
    print("Agregando productos iniciales...")
    productos = [
        Producto(negocio_id=negocio_default.id, nombre="Malteada de Chocolate", precio=50.0, disponible=True),
        Producto(negocio_id=negocio_default.id, nombre="Frappé de Oreo", precio=60.0, disponible=True),
        Producto(negocio_id=negocio_default.id, nombre="Rebanada de Pastel", precio=45.0, disponible=True),
        Producto(negocio_id=negocio_default.id, nombre="Helado Sencillo", precio=25.0, disponible=True)
    ]
    db.session.add_all(productos)
    db.session.commit()
    
    print("Database seeded successfully!")
