import os

from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_socketio import SocketIO, emit #Nuevo: Importamos SocketIO para la comunicación en tiempo real
from sqlalchemy import func



app = Flask(__name__)
CORS(app)

# NUEVO: Inicializamos SocketIO conectado a nuestra app de Flask
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuración de base de datos
database_url = os.environ.get('DATABASE_URL', 'sqlite:///kiosco_postres.db')
# SQLAlchemy requiere 'postgresql://' en lugar de 'postgres://' (que dan algunos proveedores)
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ==========================================
# MODELOS DE LA BASE DE DATOS
# ==========================================

class Negocio(db.Model):
    __tablename__ = 'negocios'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    # Relaciones para acceder fácilmente a sus productos e insumos
    productos = db.relationship('Producto', backref='negocio', lazy=True)
    insumos = db.relationship('Insumo', backref='negocio', lazy=True)

class Producto(db.Model):
    __tablename__ = 'productos'
    id = db.Column(db.Integer, primary_key=True)
    negocio_id = db.Column(db.Integer, db.ForeignKey('negocios.id'), nullable=False)
    nombre = db.Column(db.String(100), nullable=False)
    precio = db.Column(db.Float, nullable=False)
    disponible = db.Column(db.Boolean, default=True)

class Insumo(db.Model):
    __tablename__ = 'insumos'
    id = db.Column(db.Integer, primary_key=True)
    negocio_id = db.Column(db.Integer, db.ForeignKey('negocios.id'), nullable=False)
    nombre = db.Column(db.String(100), nullable=False)
    unidad_medida = db.Column(db.String(20), nullable=False) # ej: gramos, mililitros, piezas
    stock_actual = db.Column(db.Float, default=0.0)

class Receta(db.Model):
    __tablename__ = 'recetas'
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    insumo_id = db.Column(db.Integer, db.ForeignKey('insumos.id'), nullable=False)
    cantidad_necesaria = db.Column(db.Float, nullable=False)

class Orden(db.Model):
    __tablename__ = 'ordenes'
    id = db.Column(db.Integer, primary_key=True)
    negocio_id = db.Column(db.Integer, db.ForeignKey('negocios.id'), nullable=False)
    total = db.Column(db.Float, nullable=False)
    estado = db.Column(db.String(20), default="PENDIENTE") # PENDIENTE, LISTO, ENTREGADO
    # Relación para acceder a los postres de esta orden
    detalles = db.relationship('OrdenDetalle', backref='orden', lazy=True)

class OrdenDetalle(db.Model):
    __tablename__ = 'orden_detalles'
    id = db.Column(db.Integer, primary_key=True)
    orden_id = db.Column(db.Integer, db.ForeignKey('ordenes.id'), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)

# ==========================================
# RUTAS DE LA API
# ==========================================

@app.route('/api/status', methods=['GET'])
def status():
    try:
        db.engine.connect()
        return jsonify({"status": "success", "mensaje": "¡Conexión exitosa a MySQL y tablas listas!"})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": f"Error: {str(e)}"})

@app.route('/api/productos', methods=['GET'])
def obtener_productos():
    try:
        # Buscamos todos los productos que estén marcados como disponibles
        productos_db = Producto.query.filter_by(disponible=True).all()
        
        # Convertimos la información a un formato que React pueda entender (JSON)
        lista_productos = []
        for p in productos_db:
            lista_productos.append({
                "id": p.id,
                "nombre": p.nombre,
                "precio": p.precio
            })
            
        return jsonify(lista_productos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ordenes', methods=['POST'])
def crear_orden():
    try:
        datos = request.get_json()
        carrito = datos.get('carrito', [])
        total = datos.get('total', 0)
        
        if not carrito:
            return jsonify({"status": "error", "mensaje": "El carrito está vacío"}), 400

        # 1. Creamos el registro general de la Orden
        nueva_orden = Orden(negocio_id=1, total=total)
        db.session.add(nueva_orden)
        db.session.flush() # Guardamos temporalmente para obtener el ID

        # 2. Guardamos el detalle y DESCONTAMOS EL INVENTARIO
        for item in carrito:
            cantidad_comprada = item['cantidad']
            producto_id = item['id']
            subtotal = item['precio'] * cantidad_comprada
            
            # A) Guardar en el ticket
            detalle = OrdenDetalle(
                orden_id=nueva_orden.id,
                producto_id=producto_id,
                cantidad=cantidad_comprada,
                subtotal=subtotal
            )
            db.session.add(detalle)
            
            # B) Magia de Inventario: Buscar la receta de este producto
            recetas = Receta.query.filter_by(producto_id=producto_id).all()
            
            for receta in recetas:
                # Buscar el insumo correspondiente en la base de datos
                insumo = Insumo.query.get(receta.insumo_id)
                
                if insumo:
                    # Multiplicamos lo que pide la receta por los postres que pidieron
                    descuento_total = receta.cantidad_necesaria * cantidad_comprada
                    
                    # Restamos del stock actual
                    insumo.stock_actual -= descuento_total

        # 3. Confirmamos todos los cambios (Ticket + Inventario)
        db.session.commit()

        # NUEVO: ¡Avisamos a todos los conectados (la cocina) que hay un nuevo pedido al instante!
        socketio.emit('nueva_orden_creada', {"id": nueva_orden.id})
        
        return jsonify({
            "status": "success", 
            "mensaje": "¡Orden guardada e inventario actualizado!", 
            "orden_id": nueva_orden.id
        })
        
    except Exception as e:
        db.session.rollback() # Si falta inventario o hay error, no se cobra nada
        return jsonify({"status": "error", "mensaje": str(e)}), 500


# ==========================================
# INICIO DEL SERVIDOR Y CREACIÓN DE TABLAS
# ==========================================


# ==========================================
# RUTAS PARA LA COCINA (KDS)
# ==========================================

@app.route('/api/ordenes/pendientes', methods=['GET'])
def ordenes_pendientes():
    try:
        # Buscamos solo las órdenes que no se han entregado
        ordenes = Orden.query.filter_by(estado='PENDIENTE').all()
        lista_ordenes = []
        
        for orden in ordenes:
            detalles_orden = []
            # Buscamos qué postres tiene esta orden específica
            for detalle in orden.detalles:
                producto = Producto.query.get(detalle.producto_id)
                detalles_orden.append({
                    "nombre": producto.nombre,
                    "cantidad": detalle.cantidad
                })
                
            lista_ordenes.append({
                "id": orden.id,
                "estado": orden.estado,
                "detalles": detalles_orden
            })
            
        return jsonify(lista_ordenes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ordenes/<int:orden_id>/completar', methods=['PUT'])
def completar_orden(orden_id):
    try:
        orden = Orden.query.get(orden_id)
        if orden:
            orden.estado = 'LISTO'
            db.session.commit()
            # NUEVO: ¡Avisamos a todos los conectados (la cocina) que una orden ha sido completada!
            socketio.emit('orden_completada', {"id": orden.id})
            return jsonify({"status": "success", "mensaje": "Orden completada"})
        return jsonify({"status": "error", "mensaje": "Orden no encontrada"}), 404
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500

# ==========================================
# RUTAS DEL DASHBOARD (ADMIN)
# ==========================================

@app.route('/api/dashboard', methods=['GET'])
def obtener_dashboard():
    try:
        # 1. Calculamos el total de ingresos (sumando el 'total' de todas las órdenes)
        # Usamos scalar() para que nos devuelva el número directo, si no hay ventas devuelve 0
        ventas_totales = db.session.query(func.sum(Orden.total)).scalar() or 0.0
        
        # 2. Contamos cuántas órdenes se han hecho
        total_ordenes = Orden.query.count()
        
        # 3. Traemos el inventario para ver qué se está acabando
        insumos_db = Insumo.query.all()
        inventario = []
        for insumo in insumos_db:
            inventario.append({
                "id": insumo.id,
                "nombre": insumo.nombre,
                "stock": insumo.stock_actual,
                "unidad": insumo.unidad_medida
            })
            
        return jsonify({
            "status": "success",
            "ventas_totales": ventas_totales,
            "total_ordenes": total_ordenes,
            "inventario": inventario
        })
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500

# ==========================================
# RUTAS DE ADMINISTRACIÓN (CATÁLOGO)
# ==========================================

@app.route('/api/inventario/<int:id>/reabastecer', methods=['PUT'])
def reabastecer_inventario(id):
    try:
        datos = request.get_json()
        cantidad = float(datos.get('cantidad', 0))
        insumo = Insumo.query.get(id)
        if insumo:
            insumo.stock_actual += cantidad
            db.session.commit()
            return jsonify({"status": "success", "mensaje": f"Se agregaron {cantidad} a {insumo.nombre}"})
        return jsonify({"status": "error", "mensaje": "Insumo no encontrado"}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500

@app.route('/api/productos', methods=['POST'])
def agregar_producto():
    try:
        datos = request.get_json()
        nuevo_producto = Producto(
            negocio_id=1,
            nombre=datos['nombre'],
            precio=float(datos['precio']),
            disponible=True
        )
        db.session.add(nuevo_producto)
        db.session.commit()
        return jsonify({"status": "success", "mensaje": "Producto agregado con éxito"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500

















# Esto crea las tablas automáticamente si no existen
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)