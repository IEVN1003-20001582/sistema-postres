import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Howl } from 'howler';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API_URL);

// ==========================================
// CONFIGURACIÓN DE SONIDOS
// ==========================================
const sonidoBoton = new Howl({ src: ['/sounds/click.wav'], volume: 0.5 });
const sonidoMoneda = new Howl({ src: ['/sounds/notify.wav'], volume: 0.4 });
const sonidoExito = new Howl({ src: ['/sounds/success.wav'], volume: 0.5 });
const sonidoCampana = new Howl({ src: ['/sounds/notify.wav'], volume: 0.6 });

function App() {
  const [pantalla, setPantalla] = useState('inicio'); 
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]); 
  const [ordenesCocina, setOrdenesCocina] = useState([]);
  const [datosDashboard, setDatosDashboard] = useState({ ventas_totales: 0, total_ordenes: 0, inventario: [] });
  const [ticketActual, setTicketActual] = useState(null);
  const [nombreCliente, setNombreCliente] = useState(''); // NUEVO: Para guardar el nombre
  const [conectado, setConectado] = useState(true);

  // NUEVO: Estados para el panel de administración
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', precio: '' });
  const [cantidadReabastecer, setCantidadReabastecer] = useState({});
  const [nuevoInsumo, setNuevoInsumo] = useState({ nombre: '', unidad_medida: '', stock_inicial: '' });
  const [recetaForm, setRecetaForm] = useState({ producto_id: '', insumo_id: '', cantidad: '' });
  const [filtroVentas, setFiltroVentas] = useState('hoy');
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const [pasoGuia, setPasoGuia] = useState(1);
  const [filtroGuia, setFiltroGuia] = useState('');

  // ==========================================
  // FUNCIONES GENERALES
  // ==========================================
  const cambiarPantalla = (nuevaPantalla) => {
    sonidoBoton.play();
    setPantalla(nuevaPantalla);
  };

  const cargarProductos = () => {
    fetch(`${API_URL}/api/productos`)
      .then(res => res.json())
      .then(datos => {
        if (Array.isArray(datos)) setProductos(datos);
        else console.error("Error en formato de productos:", datos);
      })
      .catch(err => console.error("Error al traer productos:", err));
  };

  // ==========================================
  // FUNCIONES DEL KIOSCO
  // ==========================================
  const agregarAlCarrito = (producto) => {
    sonidoMoneda.play();
    const existe = carrito.find(item => item.id === producto.id);
    if (existe) {
      setCarrito(carrito.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
  };

  const totalOrden = carrito.reduce((suma, item) => suma + (item.precio * item.cantidad), 0);

  const enviarOrden = async () => {
    if (!nombreCliente.trim()) return alert("Por favor ingresa tu nombre para llamarte cuando esté listo.");
    try {
      const respuesta = await fetch(`${API_URL}/api/ordenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrito: carrito, total: totalOrden, nombre_cliente: nombreCliente })
      });
      const datos = await respuesta.json();
      
      if (datos.status === 'success') {
        sonidoExito.play();
        setTicketActual(datos.orden_id);
        setPantalla('exito');
        setCarrito([]); 
        setNombreCliente(''); // Limpiamos el nombre
        cargarDashboard(); // Actualizamos las ventas en el panel
      } else {
        alert("Error: " + datos.mensaje);
      }
    } catch (error) {
      console.error("Error de conexión:", error);
    }
  };

  // ==========================================
  // FUNCIONES DE COCINA
  // ==========================================
  const cargarOrdenesCocina = () => {
    fetch(`${API_URL}/api/ordenes/pendientes`)
      .then(res => res.json())
      .then(datos => {
        if (Array.isArray(datos)) setOrdenesCocina(datos);
        else console.error("Error en formato de cocina:", datos);
      })
      .catch(err => console.error("Error al cargar cocina:", err));
  };

  const completarOrden = async (id) => {
    try {
      sonidoCampana.play();
      await fetch(`${API_URL}/api/ordenes/${id}/completar`, { method: 'PUT' });
      cargarOrdenesCocina(); 
    } catch (error) {
      console.error("Error al completar:", error);
    }
  };

  // ==========================================
  // FUNCIONES DEL DASHBOARD (ADMIN)
  // ==========================================  
  const cargarDashboard = async (filtro = filtroVentas) => {
    try {
      const respuesta = await fetch(`${API_URL}/api/dashboard?filtro=${filtro}`);
      const datos = await respuesta.json();
      if(datos.status === 'success') setDatosDashboard(datos);
    } catch (err) { console.error("Error al cargar dashboard:", err); }
  };

  const manejarCrearProducto = async (e) => {
    e.preventDefault(); // Evita que recargue la página
    if (!nuevoProducto.nombre || !nuevoProducto.precio) return alert("Llena ambos campos");
    
    try {
      const respuesta = await fetch(`${API_URL}/api/productos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoProducto)
      });
      const datos = await respuesta.json();
      if (datos.status === 'success') {
        alert("¡Postre agregado al menú!");
        setNuevoProducto({ nombre: '', precio: '' });
        cargarProductos(); // Refrescamos el menú
      }
    } catch (error) {
      console.error("Error al crear producto:", error);
    }
  };

  const manejarCrearInsumo = async (e) => {
    e.preventDefault();
    if (!nuevoInsumo.nombre || !nuevoInsumo.unidad_medida) return alert("Llena nombre y unidad");
    try {
      const respuesta = await fetch(`${API_URL}/api/insumos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoInsumo)
      });
      const datos = await respuesta.json();
      if (datos.status === 'success') {
        alert("¡Ingrediente agregado al almacén!");
        setNuevoInsumo({ nombre: '', unidad_medida: '', stock_inicial: '' });
        cargarDashboard(); // Refrescamos el almacén
      }
    } catch (error) { console.error("Error al crear insumo:", error); }
  };

  const manejarCrearReceta = async (e) => {
    e.preventDefault();
    if (!recetaForm.producto_id || !recetaForm.insumo_id || !recetaForm.cantidad) return alert("Selecciona producto, insumo y cantidad");
    try {
      const respuesta = await fetch(`${API_URL}/api/recetas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recetaForm)
      });
      const datos = await respuesta.json();
      if (datos.status === 'success') {
        alert("¡Receta guardada! Ahora se descontará automáticamente.");
        setRecetaForm({ ...recetaForm, cantidad: '' });
      } else { alert("Error: " + datos.mensaje); }
    } catch (error) { console.error("Error al crear receta:", error); }
  };

  const manejarReabastecer = async (id_insumo) => {
    const cantidad = cantidadReabastecer[id_insumo];
    if (!cantidad || cantidad <= 0) return alert("Ingresa una cantidad válida");

    try {
      const respuesta = await fetch(`${API_URL}/api/inventario/${id_insumo}/reabastecer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad: cantidad })
      });
      const datos = await respuesta.json();
      if (datos.status === 'success') {
        setCantidadReabastecer({ ...cantidadReabastecer, [id_insumo]: '' }); // Limpiamos el input
        cargarDashboard(); // Refrescamos la tabla
      }
    } catch (error) {
      console.error("Error al reabastecer:", error);
    }
  };

  // ==========================================
  // EFECTOS
  // ==========================================
  useEffect(() => {
    cargarProductos();
    cargarDashboard(filtroVentas);
  }, []);

  useEffect(() => {
    if (pantalla === 'cocina') cargarOrdenesCocina();

    socket.on('connect', () => setConectado(true));
    socket.on('disconnect', () => setConectado(false));

    socket.on('nueva_orden_creada', (data) => {
      sonidoCampana.play();
      if (pantalla === 'cocina') cargarOrdenesCocina();
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('nueva_orden_creada');
    };
  }, [pantalla]);


  // ==========================================
  // RENDER DE PANTALLAS
  // ==========================================
  if (pantalla === 'inicio') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="brutal-card p-10 bg-yellow-300 text-center relative max-w-3xl z-10">
          <div className="absolute -top-10 -left-10 text-8xl rotate-12">🍰</div>
          <div className="absolute -bottom-10 -right-10 text-8xl -rotate-12">🍦</div>
          <h1 className="text-7xl font-black text-pink-600 mb-6 drop-shadow-[4px_4px_0_0_#fff]">KIOSCO DE POSTRES</h1>
          <p className="text-3xl font-bold text-gray-900 border-t-4 border-black pt-4">¡Bienvenido! ¿Qué se te antoja hoy?</p>
        </motion.div>
        
        <div className="flex space-x-8 mt-12 z-10">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => cambiarPantalla('menu')} className="brutal-btn bg-pink-500 text-white text-4xl py-6 px-12 rounded-2xl flex items-center">
            <span className="text-5xl mr-4">🛍️</span> ¡HACER PEDIDO!
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { cargarOrdenesCocina(); cambiarPantalla('cocina'); }} className="brutal-btn bg-blue-500 text-white text-4xl py-6 px-12 rounded-2xl flex items-center">
            <span className="text-5xl mr-4">🧑‍🍳</span> MODO COCINA
          </motion.button>
        </div>

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { cargarDashboard(); cambiarPantalla('admin'); }} className="brutal-btn bg-purple-500 text-white text-2xl py-4 px-8 rounded-2xl mt-12 z-10">
          👑 PANEL DE DUEÑO
        </motion.button>

        {!conectado && (
          <div className="absolute top-4 brutal-card bg-red-600 text-white font-bold py-2 px-6 animate-pulse text-xl z-50">
            🔴 Sin conexión con el servidor
          </div>
        )}
      </div>
    );
  }

  if (pantalla === 'exito') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-4 text-center">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 10 }} className="text-9xl mb-8">
          🎉
        </motion.div>
        <h2 className="text-6xl font-black text-green-600 mb-4 brutal-card bg-white p-6 inline-block">¡ORDEN ENVIADA A COCINA!</h2>
        <p className="text-3xl font-bold text-gray-800 bg-yellow-300 p-4 border-4 border-black inline-block mt-4">
          Ticket #{ticketActual}
        </p>
        <p className="text-xl font-bold mt-4">Llamaremos a {nombreCliente} cuando esté listo.</p>
        <button onClick={() => cambiarPantalla('inicio')} className="brutal-btn bg-blue-500 text-white py-4 px-10 text-2xl mt-12 rounded-2xl">
          🏠 Volver al Inicio
        </button>
      </div>
    );
  }

  if (pantalla === 'dashboard') {
    return (
      <div className="h-screen w-full bg-blue-900 p-8 overflow-y-auto font-sans flex flex-col md:flex-row gap-8">
        
        {/* COLUMNA IZQUIERDA: MÉTRICAS Y NUEVO PRODUCTO */}
        <div className="w-full md:w-1/3 flex flex-col gap-6">
          <div className="flex justify-between items-center border-b-4 border-black pb-4 brutal-card bg-white p-4">
            <h2 className="text-3xl font-black text-purple-800 tracking-wide">👑 DASHBOARD</h2>
            <button onClick={() => cambiarPantalla('inicio')} className="brutal-btn bg-gray-200 text-gray-800 py-2 px-4 rounded-lg">Volver</button>
          </div>

          <div className="brutal-card bg-green-400 p-6 text-black">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-black">INGRESOS</h3>
              <div className="flex bg-white border-4 border-black rounded-lg overflow-hidden text-sm font-bold">
                <button onClick={() => { setFiltroVentas('hoy'); cargarDashboard('hoy'); }} className={`px-3 py-1 border-r-4 border-black ${filtroVentas === 'hoy' ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>Hoy</button>
                <button onClick={() => { setFiltroVentas('semana'); cargarDashboard('semana'); }} className={`px-3 py-1 border-r-4 border-black ${filtroVentas === 'semana' ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>Sem</button>
                <button onClick={() => { setFiltroVentas('mes'); cargarDashboard('mes'); }} className={`px-3 py-1 border-r-4 border-black ${filtroVentas === 'mes' ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>Mes</button>
                <button onClick={() => { setFiltroVentas('todo'); cargarDashboard('todo'); }} className={`px-3 py-1 ${filtroVentas === 'todo' ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>Todo</button>
              </div>
            </div>
            <p className="text-6xl font-black">${datosDashboard.ventas_totales.toFixed(2)}</p>
          </div>
          
          <div className="brutal-card bg-blue-400 p-6 text-black">
            <h3 className="text-xl font-black mb-1">ÓRDENES ({filtroVentas.toUpperCase()})</h3>
            <p className="text-6xl font-black">{datosDashboard.total_ordenes}</p>
          </div>

          {/* FORMULARIO CREAR POSTRE */}
          <div className="brutal-card bg-pink-300 p-6 mt-4">
            <h3 className="text-xl font-black text-black mb-4">🍩 NUEVO POSTRE</h3>
            <form onSubmit={manejarCrearProducto} className="flex flex-col gap-4">
              <input type="text" placeholder="Nombre (ej. Malteada)" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({...nuevoProducto, nombre: e.target.value})} className="p-3 rounded-xl outline-none border-4 border-black font-bold" />
              <input type="number" placeholder="Precio ($)" value={nuevoProducto.precio} onChange={(e) => setNuevoProducto({...nuevoProducto, precio: e.target.value})} className="p-3 rounded-xl outline-none border-4 border-black font-bold" />
              <button type="submit" className="brutal-btn bg-pink-500 text-white py-3 rounded-xl">GUARDAR</button>
            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA: INVENTARIO */}
        <div className="w-full md:w-2/3 flex flex-col">
          <h3 className="text-3xl font-black text-white mb-6 flex items-center mt-2 bg-black inline-block p-2 rounded-xl">
            📦 ALMACÉN Y REABASTECIMIENTO
            <button onClick={() => { sonidoBoton.play(); cargarDashboard(); }} className="brutal-btn ml-4 text-sm bg-yellow-400 py-2 px-4 rounded-full text-black">🔄 Actualizar</button>
          </h3>
          
          <div className="brutal-card bg-orange-200 overflow-hidden flex-1 p-0 mb-6">
            <table className="w-full text-left text-black">
              <thead className="bg-black text-white uppercase text-sm font-black border-b-4 border-black">
                <tr>
                  <th className="px-6 py-4">Insumo</th>
                  <th className="px-6 py-4 text-center">Stock Actual</th>
                  <th className="px-6 py-4">Ingreso (Proveedor)</th>
                </tr>
              </thead>
              <tbody className="divide-y-4 divide-black">
                {datosDashboard.inventario.map(item => (
                  <tr key={item.id} className="hover:bg-orange-300 transition-colors font-bold text-lg">
                    <td className="px-6 py-4 border-r-4 border-black">
                      {item.nombre}
                      {item.stock < 500 && <span className="ml-2 bg-red-600 text-white py-1 px-3 rounded-full text-xs font-black border-2 border-black">BAJO</span>}
                    </td>
                    <td className="px-6 py-4 text-center text-3xl font-black border-r-4 border-black bg-white">
                      {item.stock} <span className="text-sm text-gray-500 font-bold">{item.unidad}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <input 
                          type="number" placeholder="Cant." min="1"
                          value={cantidadReabastecer[item.id] || ''}
                          onChange={(e) => setCantidadReabastecer({...cantidadReabastecer, [item.id]: e.target.value})}
                          className="w-24 border-4 border-black p-2 rounded-lg outline-none text-center font-bold"
                        />
                        <button 
                          onClick={() => manejarReabastecer(item.id)}
                          className="brutal-btn bg-green-400 text-black px-4 py-2 rounded-lg text-lg"
                        >
                          ➕ SUMAR
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row gap-6 mt-2">
            {/* FORMULARIO CREAR INSUMO */}
            <div className="brutal-card bg-blue-300 p-6 flex-1">
              <h3 className="text-xl font-black text-black mb-4">🧅 NUEVO INGREDIENTE</h3>
              <form onSubmit={manejarCrearInsumo} className="flex flex-col gap-4">
                <input type="text" placeholder="Nombre (ej. Leche)" value={nuevoInsumo.nombre} onChange={(e) => setNuevoInsumo({...nuevoInsumo, nombre: e.target.value})} className="border-4 border-black p-3 rounded-xl outline-none font-bold" />
                <input type="text" placeholder="Unidad (ej. ml, gramos)" value={nuevoInsumo.unidad_medida} onChange={(e) => setNuevoInsumo({...nuevoInsumo, unidad_medida: e.target.value})} className="border-4 border-black p-3 rounded-xl outline-none font-bold" />
                <button type="submit" className="brutal-btn bg-blue-500 text-white py-3 rounded-xl">AGREGAR</button>
              </form>
            </div>

            {/* FORMULARIO VINCULAR RECETA */}
            <div className="brutal-card bg-cyan-300 p-6 flex-1">
              <h3 className="text-xl font-black text-black mb-4">🔗 VINCULAR RECETA</h3>
              <form onSubmit={manejarCrearReceta} className="flex flex-col gap-4">
                <select value={recetaForm.producto_id} onChange={(e) => setRecetaForm({...recetaForm, producto_id: e.target.value})} className="border-4 border-black p-3 rounded-xl outline-none font-bold">
                  <option value="">-- Elige un Producto --</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <select value={recetaForm.insumo_id} onChange={(e) => setRecetaForm({...recetaForm, insumo_id: e.target.value})} className="border-4 border-black p-3 rounded-xl outline-none font-bold">
                  <option value="">-- Elige un Ingrediente --</option>
                  {datosDashboard.inventario.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                </select>
                <input type="number" step="0.1" placeholder="Gasto por orden" value={recetaForm.cantidad} onChange={(e) => setRecetaForm({...recetaForm, cantidad: e.target.value})} className="border-4 border-black p-3 rounded-xl outline-none font-bold" />
                <button type="submit" className="brutal-btn bg-cyan-500 text-white py-3 rounded-xl">GUARDAR RECETA</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pantalla === 'cocina') {
    return (
      <div className="h-screen w-full bg-gray-900 p-8 overflow-y-auto pattern-diagonal-lines-sm text-white">
        <div className="flex justify-between items-center mb-10 border-b-8 border-gray-700 pb-6 bg-black p-6 rounded-3xl shadow-[8px_8px_0_0_#4ade80]">
          <h2 className="text-5xl font-black text-yellow-400 tracking-widest uppercase">🔥 MISIÓN: COCINA 🔥</h2>
          <button onClick={() => cambiarPantalla('inicio')} className="brutal-btn bg-red-500 text-white py-3 px-6 rounded-xl text-xl">SALIR DE COCINA</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {ordenesCocina.length === 0 ? (
            <h3 className="text-4xl text-white bg-black p-8 border-8 border-white rounded-3xl font-black col-span-full text-center mt-20 rotate-3">Zzz... NO HAY PEDIDOS. ¡ESPERANDO ACCIÓN!</h3>
          ) : (
            <AnimatePresence>
              {ordenesCocina.map((orden) => (
                <motion.div key={orden.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5, y: -100, rotate: 10 }} className="brutal-card bg-orange-500 p-6 flex flex-col justify-between">
                  <div className="bg-white text-black font-black text-3xl px-4 py-2 rounded-xl border-4 border-black mb-4 text-center">
                    TICKET #{orden.id}<br/>
                    <span className="text-xl text-red-600">{orden.nombre_cliente?.toUpperCase()}</span>
                  </div>
                  <div className="mb-6 space-y-3 bg-yellow-100 p-4 border-4 border-black rounded-xl">
                    {orden.detalles.map((item, index) => (
                      <div key={index} className="flex items-center text-xl text-black border-b-2 border-black pb-2">
                        <span className="font-black text-red-600 mr-4 text-3xl">x{item.cantidad}</span><span className="font-bold">{item.nombre}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => completarOrden(orden.id)} className="brutal-btn w-full bg-green-400 text-black text-3xl py-4 rounded-xl">¡LISTO! ✅</button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* MODAL GUÍA INTERACTIVA */}
        {mostrarGuia && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.8, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="brutal-card bg-white p-8 max-w-lg w-full text-center relative">
              <button onClick={() => { setMostrarGuia(false); setFiltroGuia(''); }} className="brutal-btn absolute -top-6 -right-6 bg-red-500 text-white w-12 h-12 rounded-full text-2xl">X</button>
              
              <div className="text-8xl mb-4 bg-pink-300 inline-block rounded-full p-4 border-4 border-black">🧙‍♂️</div>
              <h2 className="text-4xl font-black text-black mb-6 uppercase">Tu Guía Dulce</h2>

              {pasoGuia === 1 && (
                <div className="space-y-6">
                  <p className="text-2xl font-bold text-gray-700 bg-yellow-200 p-4 border-4 border-black">¿Qué se te antoja hoy?</p>
                  <button onClick={() => setPasoGuia(2)} className="brutal-btn w-full bg-cyan-300 text-black text-3xl py-4 rounded-2xl">🧊 Algo Fresco</button>
                  <button onClick={() => setPasoGuia(3)} className="brutal-btn w-full bg-orange-400 text-black text-3xl py-4 rounded-2xl">🔥 Algo Horneado</button>
                </div>
              )}

              {pasoGuia === 2 && (
                <div className="space-y-6">
                  <p className="text-xl font-bold text-black bg-cyan-100 p-4 border-4 border-black">¡Filtraremos el menú con nuestras mejores bebidas y helados fríos!</p>
                  <button onClick={() => { setFiltroGuia('frio'); setMostrarGuia(false); }} className="brutal-btn w-full bg-blue-500 text-white text-3xl py-4 rounded-2xl">¡VER MENÚ! 🍦</button>
                </div>
              )}

              {pasoGuia === 3 && (
                <div className="space-y-6">
                  <p className="text-xl font-bold text-black bg-orange-100 p-4 border-4 border-black">¡Filtraremos el menú con nuestros mejores postres recién horneados!</p>
                  <button onClick={() => { setFiltroGuia('horneado'); setMostrarGuia(false); }} className="brutal-btn w-full bg-red-500 text-white text-3xl py-4 rounded-2xl">¡VER MENÚ! 🍰</button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // default: MENU Y CARRITO
  return (
    <div className="h-screen w-full flex overflow-hidden relative">
        {!conectado && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 brutal-card bg-red-600 text-white font-bold py-2 px-6 animate-pulse text-xl z-50">
            🔴 Sin conexión con el servidor
          </div>
        )}
      <div className="w-2/3 p-8 overflow-y-auto pattern-diagonal-lines-sm bg-yellow-200">
        <h2 className="text-6xl font-black text-pink-600 mb-10 drop-shadow-[4px_4px_0_0_#fff] bg-white inline-block p-4 border-4 border-black rotate-2">ELIGE TU POSTRE 🍰</h2>
        
        {/* BOTÓN GUÍA */}
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setMostrarGuia(true); setPasoGuia(1); setFiltroGuia(''); }} className="brutal-btn fixed bottom-6 right-[35%] bg-cyan-400 text-black p-4 rounded-full flex items-center justify-center z-40 text-4xl w-24 h-24">
          🗺️
        </motion.button>

        {/* MENÚ PRINCIPAL */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32 relative z-10">
          <AnimatePresence>
            {productos.filter(p => p.nombre.toLowerCase().includes(filtroGuia.toLowerCase()) || (filtroGuia === 'frio' && (p.nombre.toLowerCase().includes('helado') || p.nombre.toLowerCase().includes('frap') || p.nombre.toLowerCase().includes('malteada'))) || (filtroGuia === 'horneado' && (p.nombre.toLowerCase().includes('pastel') || p.nombre.toLowerCase().includes('crepa') || p.nombre.toLowerCase().includes('pan') || p.nombre.toLowerCase().includes('caf')))).map((producto) => (
              <motion.div key={producto.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => agregarAlCarrito(producto)} className="brutal-card bg-white p-6 flex flex-col items-center justify-between cursor-pointer select-none">
                <div className="text-7xl mb-6">{producto.nombre.includes('Frappé') || producto.nombre.includes('Malteada') ? '🥤' : '🎂'}</div>
                <h3 className="text-2xl font-black text-center text-black mb-6 uppercase tracking-tight leading-tight">{producto.nombre}</h3>
                <div className="brutal-card bg-green-400 text-black text-3xl font-black py-2 px-6 shadow-none">
                  ${producto.precio.toFixed(2)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="w-1/3 bg-white border-l-8 border-black p-8 flex flex-col shadow-[-10px_0_0_0_rgba(0,0,0,0.1)] relative z-10">
        <h2 className="text-5xl font-black text-black mb-6 border-b-8 border-black pb-4">TU ORDEN 📋</h2>
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {carrito.length === 0 ? <p className="text-2xl text-gray-400 font-black text-center mt-10">Aún no hay postres en tu orden.</p> : (
            <AnimatePresence>
              {carrito.map((item, index) => (
                <motion.div key={index} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="brutal-card bg-pink-200 p-4 flex justify-between items-center">
                  <div className="flex flex-col"><span className="font-black text-2xl text-black">{item.nombre}</span><span className="text-gray-700 font-black text-xl">x {item.cantidad}</span></div>
                  <span className="font-black text-3xl text-black bg-white px-2 py-1 border-4 border-black">${(item.precio * item.cantidad).toFixed(2)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
        <div className="pt-6 border-t-8 border-black mt-4">
          <input 
            type="text" 
            placeholder="¿CUÁL ES TU NOMBRE?" 
            value={nombreCliente} 
            onChange={(e) => setNombreCliente(e.target.value)}
            className="w-full text-2xl p-4 mb-6 border-4 border-black rounded-xl outline-none font-black text-black bg-cyan-100 placeholder-gray-500"
          />
          <div className="flex justify-between items-center mb-6"><span className="text-4xl font-black text-black">TOTAL:</span><span className="text-5xl font-black text-green-500 drop-shadow-[2px_2px_0_0_#000]">${totalOrden.toFixed(2)}</span></div>
          <motion.button onClick={enviarOrden} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} disabled={carrito.length === 0} className={`w-full text-black text-4xl py-6 rounded-2xl ${carrito.length === 0 ? 'bg-gray-300 border-4 border-gray-500 text-gray-500 cursor-not-allowed' : 'brutal-btn bg-green-400'}`}>
            ¡CONFIRMAR! ✅
          </motion.button>
          <button onClick={() => cambiarPantalla('inicio')} className="w-full mt-6 text-red-600 text-2xl font-black py-3 rounded-xl border-4 border-transparent hover:border-red-600 transition-colors">CANCELAR Y VOLVER</button>
        </div>
      </div>
    </div>
  );
}

export default App;