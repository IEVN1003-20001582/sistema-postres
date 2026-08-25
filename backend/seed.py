from app import app, db, Negocio, Producto, Insumo, Receta

def insertar_datos_prueba():
    # Usamos el contexto de la app para poder hablar con la base de datos
    with app.app_context():
        # OPCIONAL: Esto borra y vuelve a crear las tablas para empezar limpios
        db.drop_all()
        db.create_all()

        print("Creando el negocio...")
        mi_negocio = Negocio(nombre="Postres Arcade")
        db.session.add(mi_negocio)
        db.session.commit() # Guardamos para que MySQL le asigne el ID 1

        print("Creando el inventario (insumos)...")
        # Imaginemos que compramos 5 litros de leche, 100 vasos y 1 kg de cacao
        leche = Insumo(negocio_id=mi_negocio.id, nombre="Leche Entera", unidad_medida="mililitros", stock_actual=5000)
        vasos = Insumo(negocio_id=mi_negocio.id, nombre="Vaso Frappé 16oz", unidad_medida="piezas", stock_actual=100)
        cacao = Insumo(negocio_id=mi_negocio.id, nombre="Cacao en polvo", unidad_medida="gramos", stock_actual=1000)
        
        db.session.add_all([leche, vasos, cacao])
        db.session.commit()

        print("Creando los postres (productos)...")
        frappe = Producto(negocio_id=mi_negocio.id, nombre="Frappé Nivel 1", precio=65.00, disponible=True)
        pastel = Producto(negocio_id=mi_negocio.id, nombre="Rebanada Pastel de Chocolate", precio=45.00, disponible=True)
        db.session.add_all([frappe, pastel])
        db.session.commit()

        print("Configurando las recetas exactas...")
        # Le decimos al sistema: "Para hacer 1 Frappé Nivel 1, descuenta 250ml de leche, 1 vaso y 40g de cacao"
        receta_1 = Receta(producto_id=frappe.id, insumo_id=leche.id, cantidad_necesaria=250)
        receta_2 = Receta(producto_id=frappe.id, insumo_id=vasos.id, cantidad_necesaria=1)
        receta_3 = Receta(producto_id=frappe.id, insumo_id=cacao.id, cantidad_necesaria=40)
        
        db.session.add_all([receta_1, receta_2, receta_3])
        db.session.commit()

        print("¡Misión Cumplida! Datos insertados correctamente en MySQL.")

if __name__ == '__main__':
    insertar_datos_prueba()