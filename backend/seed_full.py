import os
from app import app, db, Negocio, Producto, Insumo, Receta

def seed_db():
    with app.app_context():
        # Obtener el negocio (debe existir)
        negocio = Negocio.query.first()
        if not negocio:
            negocio = Negocio(nombre="Kiosco de Postres Mágicos")
            db.session.add(negocio)
            db.session.commit()
            
        from app import Orden, OrdenDetalle
        
        print("Borrando historial de ordenes, recetas, productos e insumos existentes...")
        OrdenDetalle.query.delete()
        Orden.query.delete()
        Receta.query.delete()
        Producto.query.delete()
        Insumo.query.delete()
        db.session.commit()

        print("Creando insumos...")
        insumos_data = [
            {"nombre": "Leche Entera", "unidad": "L", "stock": 20},
            {"nombre": "Leche Deslactosada", "unidad": "L", "stock": 15},
            {"nombre": "Café Espresso", "unidad": "ml", "stock": 5000},
            {"nombre": "Jarabe de Caramelo", "unidad": "ml", "stock": 2000},
            {"nombre": "Jarabe de Chocolate", "unidad": "ml", "stock": 2000},
            {"nombre": "Azúcar", "unidad": "Kg", "stock": 10},
            {"nombre": "Harina de Trigo", "unidad": "Kg", "stock": 15},
            {"nombre": "Huevo", "unidad": "Pza", "stock": 100},
            {"nombre": "Nutella", "unidad": "g", "stock": 3000},
            {"nombre": "Fresas Frescas", "unidad": "g", "stock": 2500},
            {"nombre": "Crema Batida", "unidad": "g", "stock": 1500},
            {"nombre": "Masa para Crepas", "unidad": "ml", "stock": 4000},
            {"nombre": "Base para Helado Vainilla", "unidad": "L", "stock": 10},
            {"nombre": "Base para Helado Chocolate", "unidad": "L", "stock": 10},
            {"nombre": "Vasos Frappé", "unidad": "Pza", "stock": 500},
            {"nombre": "Té Negro", "unidad": "g", "stock": 1000},
            {"nombre": "Masa para Waffle", "unidad": "ml", "stock": 3000},
            {"nombre": "Queso Crema", "unidad": "Kg", "stock": 5}
        ]
        
        insumos_objs = {}
        for d in insumos_data:
            i = Insumo(negocio_id=negocio.id, nombre=d["nombre"], unidad_medida=d["unidad"], stock_actual=d["stock"])
            db.session.add(i)
            insumos_objs[d["nombre"]] = i
        db.session.commit()
        
        print("Creando productos estelares...")
        productos_data = [
            {"nombre": "Frappé Moka Extremo", "precio": 75.0, "desc": "Frío"},
            {"nombre": "Frappé Caramelo Dorado", "precio": 70.0, "desc": "Frío"},
            {"nombre": "Helado Vainilla Nube", "precio": 45.0, "desc": "Frío"},
            {"nombre": "Helado Choco Galaxia", "precio": 50.0, "desc": "Frío"},
            {"nombre": "Malteada Fresa Mágica", "precio": 65.0, "desc": "Frío"},
            {"nombre": "Té Helado Cítrico", "precio": 35.0, "desc": "Frío"},
            {"nombre": "Limonada Rosa Brillante", "precio": 30.0, "desc": "Frío"},
            {"nombre": "Pastel Imposible", "precio": 60.0, "desc": "Horneado"},
            {"nombre": "Crepa Nutella Fresa", "precio": 80.0, "desc": "Horneado"},
            {"nombre": "Crepa Queso Zarzamora", "precio": 85.0, "desc": "Horneado"},
            {"nombre": "Waffle Belga Clásico", "precio": 75.0, "desc": "Horneado"},
            {"nombre": "Cheesecake New York", "precio": 70.0, "desc": "Horneado"},
            {"nombre": "Brownie Volcán Caliente", "precio": 55.0, "desc": "Horneado"},
            {"nombre": "Capuchino Clásico", "precio": 45.0, "desc": "Caliente"},
            {"nombre": "Chocolate Caliente Suave", "precio": 50.0, "desc": "Caliente"},
            {"nombre": "Galleta Chispas Gigante", "precio": 25.0, "desc": "Horneado"}
        ]
        
        prod_objs = {}
        for p in productos_data:
            pr = Producto(negocio_id=negocio.id, nombre=p["nombre"], precio=p["precio"])
            db.session.add(pr)
            prod_objs[p["nombre"]] = pr
        db.session.commit()
        
        print("Vinculando recetas...")
        recetas_data = [
            # Frappe Moka
            {"prod": "Frappé Moka Extremo", "insumo": "Leche Entera", "cant": 0.2},
            {"prod": "Frappé Moka Extremo", "insumo": "Café Espresso", "cant": 30},
            {"prod": "Frappé Moka Extremo", "insumo": "Jarabe de Chocolate", "cant": 20},
            {"prod": "Frappé Moka Extremo", "insumo": "Crema Batida", "cant": 15},
            {"prod": "Frappé Moka Extremo", "insumo": "Vasos Frappé", "cant": 1},
            
            # Frappe Caramelo
            {"prod": "Frappé Caramelo Dorado", "insumo": "Leche Entera", "cant": 0.2},
            {"prod": "Frappé Caramelo Dorado", "insumo": "Café Espresso", "cant": 30},
            {"prod": "Frappé Caramelo Dorado", "insumo": "Jarabe de Caramelo", "cant": 20},
            {"prod": "Frappé Caramelo Dorado", "insumo": "Vasos Frappé", "cant": 1},
            
            # Crepa Nutella
            {"prod": "Crepa Nutella Fresa", "insumo": "Masa para Crepas", "cant": 150},
            {"prod": "Crepa Nutella Fresa", "insumo": "Nutella", "cant": 50},
            {"prod": "Crepa Nutella Fresa", "insumo": "Fresas Frescas", "cant": 40},
            
            # Pastel Imposible
            {"prod": "Pastel Imposible", "insumo": "Harina de Trigo", "cant": 0.1},
            {"prod": "Pastel Imposible", "insumo": "Huevo", "cant": 1},
            
            # Waffle Belga
            {"prod": "Waffle Belga Clásico", "insumo": "Masa para Waffle", "cant": 200},
            {"prod": "Waffle Belga Clásico", "insumo": "Jarabe de Caramelo", "cant": 30},
            
            # Capuchino
            {"prod": "Capuchino Clásico", "insumo": "Leche Entera", "cant": 0.25},
            {"prod": "Capuchino Clásico", "insumo": "Café Espresso", "cant": 30}
        ]
        
        for r in recetas_data:
            prod = prod_objs.get(r["prod"])
            ins = insumos_objs.get(r["insumo"])
            if prod and ins:
                receta = Receta(producto_id=prod.id, insumo_id=ins.id, cantidad_necesaria=r["cant"])
                db.session.add(receta)
        db.session.commit()
        
        print("✅ Base de datos poblada exitosamente!")

if __name__ == "__main__":
    seed_db()
