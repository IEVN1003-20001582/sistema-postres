import eventlet
eventlet.monkey_patch()

from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.pool import NullPool
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from sqlalchemy import func

import os
import secrets
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

# NUEVO: Inicializamos SocketIO conectado a nuestra app de Flask
socketio = SocketIO(app, cors_allowed_origins="*")

import ssl

# Configuración de base de datos
NEON_URL = "postgresql://neondb_owner:npg_yNkmWL02cSEu@ep-rapid-smoke-ax9b9xmt.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
database_url = os.environ.get('DATABASE_URL', NEON_URL)
# SQLAlchemy requiere 'postgresql://' en lugar de 'postgres://' (que dan algunos proveedores)
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+pg8000://", 1)
    if "?" in database_url:
        database_url = database_url.split("?")[0]
    
    ssl_context = ssl.create_default_context()
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'poolclass': NullPool, 'connect_args': {'ssl_context': ssl_context}}
else:
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'poolclass': NullPool}

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Solución definitiva para el error de "lock" con eventlet y psycopg2

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
    usuarios = db.relationship('Usuario', backref='negocio', lazy=True)

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    negocio_id = db.Column(db.Integer, db.ForeignKey('negocios.id'), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=True) # Para sesiones simples
    rol = db.Column(db.String(20), default="dueño") # dueño, cajero, cocina

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
    nombre_cliente = db.Column(db.String(100), nullable=True) # NUEVO: Para identificar de quién es la orden
    total = db.Column(db.Float, nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.utcnow) # NUEVO: Fecha y hora exacta de la orden
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

# ==========================================
# RUTAS DE AUTENTICACIÓN
# ==========================================

def requerir_autenticacion(f):
    from functools import wraps
    @wraps(f)
    def decorador(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "Falta token de autorización"}), 401
        
        token = token.replace("Bearer ", "")
        usuario = Usuario.query.filter_by(token=token).first()
        
        if not usuario:
            return jsonify({"error": "Token inválido"}), 401
            
        return f(usuario, *args, **kwargs)
    return decorador

@app.route('/api/auth/registro', methods=['POST'])
def registro():
    datos = request.get_json()
    nombre_negocio = datos.get('nombre_negocio')
    username = datos.get('username')
    password = datos.get('password')
    
    if not nombre_negocio or not username or not password:
        return jsonify({"error": "Faltan datos requeridos"}), 400
        
    if Usuario.query.filter_by(username=username).first():
        return jsonify({"error": "El usuario ya existe"}), 400
        
    try:
        # 1. Crear negocio
        nuevo_negocio = Negocio(nombre=nombre_negocio)
        db.session.add(nuevo_negocio)
        db.session.flush() # Para obtener ID
        
        # 2. Crear usuario dueño
        nuevo_usuario = Usuario(
            negocio_id=nuevo_negocio.id,
            username=username,
            password_hash=generate_password_hash(password),
            token=secrets.token_hex(32)
        )
        db.session.add(nuevo_usuario)
        db.session.commit()
        
        return jsonify({
            "status": "success", 
            "mensaje": "Negocio registrado exitosamente",
            "token": nuevo_usuario.token,
            "negocio_id": nuevo_negocio.id,
            "negocio_nombre": nuevo_negocio.nombre
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    datos = request.get_json()
    username = datos.get('username')
    password = datos.get('password')
    
    usuario = Usuario.query.filter_by(username=username).first()
    
    if not usuario or not check_password_hash(usuario.password_hash, password):
        return jsonify({"error": "Credenciales inválidas"}), 401
        
    # Renovar token opcionalmente, pero podemos dejar el mismo por ahora
    if not usuario.token:
        usuario.token = secrets.token_hex(32)
        db.session.commit()
        
    negocio = Negocio.query.get(usuario.negocio_id)
        
    return jsonify({
        "status": "success",
        "token": usuario.token,
        "negocio_id": usuario.negocio_id,
        "negocio_nombre": negocio.nombre,
        "rol": usuario.rol
    })

@app.route('/api/productos', methods=['GET'])
@requerir_autenticacion
def obtener_productos(usuario_auth):
    try:
        # Buscamos todos los productos que estén marcados como disponibles en EL NEGOCIO ESPECÍFICO
        productos_db = Producto.query.filter_by(negocio_id=usuario_auth.negocio_id, disponible=True).all()
        
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
@requerir_autenticacion
def crear_orden(usuario_auth):
    try:
        datos = request.get_json()
        carrito = datos.get('carrito', [])
        total = datos.get('total', 0)
        
        if not carrito:
            return jsonify({"status": "error", "mensaje": "El carrito está vacío"}), 400

        # 1. Creamos el registro general de la Orden
        nueva_orden = Orden(negocio_id=usuario_auth.negocio_id, total=float(datos['total']), nombre_cliente=datos.get('nombre_cliente', 'Sin nombre'))
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
@requerir_autenticacion
def ordenes_pendientes(usuario_auth):
    try:
        # Buscamos solo las órdenes que no se han entregado
        ordenes = Orden.query.filter_by(negocio_id=usuario_auth.negocio_id, estado='PENDIENTE').all()
        lista_ordenes = []
        
        for o in ordenes:
            lista_ordenes.append({
                "id": o.id,
                "nombre_cliente": o.nombre_cliente,
                "total": o.total,
                "estado": o.estado,
                "detalles": [{"nombre": d.producto.nombre, "cantidad": d.cantidad} for d in o.detalles]
            })
            
        return jsonify(lista_ordenes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ordenes/<int:orden_id>/completar', methods=['PUT'])
@requerir_autenticacion
def completar_orden(usuario_auth, orden_id):
    try:
        orden = Orden.query.get(orden_id)
        if orden and orden.negocio_id == usuario_auth.negocio_id:
            orden.estado = 'LISTO'
            
            # --- NUEVO: Lógica de deducción de inventario ---
            for detalle in orden.detalles:
                recetas = Receta.query.filter_by(producto_id=detalle.producto_id).all()
                for receta in recetas:
                    insumo = Insumo.query.get(receta.insumo_id)
                    if insumo:
                        insumo.stock_actual -= (receta.cantidad_necesaria * detalle.cantidad)
            # ------------------------------------------------
            
            db.session.commit()
            # NUEVO: ¡Avisamos a todos los conectados (la cocina) que una orden ha sido completada!
            socketio.emit('orden_completada', {"id": orden.id})
            return jsonify({"status": "success", "mensaje": "Orden completada y almacén actualizado"})
        return jsonify({"status": "error", "mensaje": "Orden no encontrada"}), 404
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500

# ==========================================
# RUTAS DEL DASHBOARD (ADMIN)
# ==========================================

@app.route('/api/dashboard', methods=['GET'])
@requerir_autenticacion
def obtener_dashboard(usuario_auth):
    try:
        filtro = request.args.get('filtro', 'hoy') # hoy, semana, mes, todo
        
        query = db.session.query(Orden).filter_by(negocio_id=usuario_auth.negocio_id)
        hoy = datetime.utcnow()
        
        if filtro == 'hoy':
            inicio = hoy.replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(Orden.fecha >= inicio)
        elif filtro == 'semana':
            inicio = (hoy - timedelta(days=hoy.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(Orden.fecha >= inicio)
        elif filtro == 'mes':
            inicio = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(Orden.fecha >= inicio)
            
        ventas_totales = db.session.query(func.sum(Orden.total)).filter(Orden.id.in_([o.id for o in query.all()])).scalar() or 0.0
        total_ordenes = query.count()
        
        # 3. Traemos el inventario para ver qué se está acabando
        insumos_db = Insumo.query.filter_by(negocio_id=usuario_auth.negocio_id).all()
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
# RUTAS DE ADMINISTRACIÓN (CATÁLOGO Y ALMACÉN)
# ==========================================

@app.route('/api/insumos', methods=['GET'])
@requerir_autenticacion
def obtener_insumos(usuario_auth):
    try:
        insumos = Insumo.query.filter_by(negocio_id=usuario_auth.negocio_id).all()
        return jsonify([{"id": i.id, "nombre": i.nombre, "unidad_medida": i.unidad_medida, "stock_actual": i.stock_actual} for i in insumos])
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500

@app.route('/api/insumos', methods=['POST'])
@requerir_autenticacion
def agregar_insumo(usuario_auth):
    try:
        datos = request.get_json()
        nuevo_insumo = Insumo(
            negocio_id=usuario_auth.negocio_id,
            nombre=datos['nombre'],
            unidad_medida=datos['unidad_medida'],
            stock_actual=float(datos.get('stock_inicial', 0))
        )
        db.session.add(nuevo_insumo)
        db.session.commit()
        return jsonify({"status": "success", "mensaje": "Insumo creado", "id": nuevo_insumo.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500

@app.route('/api/recetas', methods=['POST'])
@requerir_autenticacion
def agregar_receta(usuario_auth):
    try:
        datos = request.get_json()
        nueva_receta = Receta(
            producto_id=int(datos['producto_id']),
            insumo_id=int(datos['insumo_id']),
            cantidad_necesaria=float(datos['cantidad'])
        )
        db.session.add(nueva_receta)
        db.session.commit()
        return jsonify({"status": "success", "mensaje": "Receta enlazada correctamente"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500

@app.route('/api/productos/<int:producto_id>/receta', methods=['GET'])
@requerir_autenticacion
def obtener_receta_producto(usuario_auth, producto_id):
    try:
        producto = Producto.query.get(producto_id)
        if not producto or producto.negocio_id != usuario_auth.negocio_id:
            return jsonify({"error": "No autorizado o no encontrado"}), 403
            
        recetas = Receta.query.filter_by(producto_id=producto_id).all()
        lista = []
        for r in recetas:
            insumo = Insumo.query.get(r.insumo_id)
            lista.append({
                "id": r.id,
                "insumo": insumo.nombre if insumo else "Desconocido",
                "cantidad": r.cantidad_necesaria,
                "unidad": insumo.unidad_medida if insumo else ""
            })
        return jsonify(lista)
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500


@app.route('/api/inventario/<int:id>/reabastecer', methods=['PUT'])
@requerir_autenticacion
def reabastecer_inventario(usuario_auth, id):
    try:
        datos = request.get_json()
        cantidad = float(datos.get('cantidad', 0))
        insumo = Insumo.query.get(id)
        if insumo and insumo.negocio_id == usuario_auth.negocio_id:
            insumo.stock_actual += cantidad
            db.session.commit()
            return jsonify({"status": "success", "mensaje": f"Se agregaron {cantidad} a {insumo.nombre}"})
        return jsonify({"status": "error", "mensaje": "Insumo no encontrado"}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500

@app.route('/api/productos', methods=['POST'])
@requerir_autenticacion
def agregar_producto(usuario_auth):
    try:
        datos = request.get_json()
        nuevo_producto = Producto(
            negocio_id=usuario_auth.negocio_id,
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
    # No pre-poblamos un negocio porque ahora los usuarios se registran.
    pass

if __name__ == '__main__':
    
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)