import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Howl } from 'howler';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

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

  // NUEVO: Estados para el panel de administración
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', precio: '' });
  const [cantidadReabastecer, setCantidadReabastecer] = useState({});

  // ==========================================
  // FUNCIONES GENERALES
  // ==========================================
  const cambiarPantalla = (nuevaPantalla) => {
    sonidoBoton.play();
    setPantalla(nuevaPantalla);
  };

  const cargarProductos = () => {
    fetch('http://localhost:5000/api/productos')
      .then(res => res.json())
      .then(datos => setProductos(datos))
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
    try {
      const respuesta = await fetch('http://localhost:5000/api/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrito: carrito, total: totalOrden })
      });
      const datos = await respuesta.json();
      
      if (datos.status === 'success') {
        sonidoExito.play();
        setTicketActual(datos.orden_id);
        setPantalla('exito');
        setCarrito([]); 
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
    fetch('http://localhost:5000/api/ordenes/pendientes')
      .then(res => res.json())
      .then(datos => setOrdenesCocina(datos))
      .catch(err => console.error("Error al cargar cocina:", err));
  };

  const completarOrden = async (id) => {
    try {
      sonidoCampana.play();
      await fetch(`http://localhost:5000/api/ordenes/${id}/completar`, { method: 'PUT' });
      cargarOrdenesCocina(); 
    } catch (error) {
      console.error("Error al completar:", error);
    }
  };

  // ==========================================
  // FUNCIONES DEL DASHBOARD (ADMIN)
  // ==========================================
  const cargarDashboard = () => {
    fetch('http://localhost:5000/api/dashboard')
      .then(res => res.json())
      .then(datos => { if(datos.status === 'success') setDatosDashboard(datos); })
      .catch(err => console.error("Error al cargar dashboard:", err));
  };

  const manejarCrearProducto = async (e) => {
    e.preventDefault(); // Evita que recargue la página
    if (!nuevoProducto.nombre || !nuevoProducto.precio) return alert("Llena ambos campos");
    
    try {
      const respuesta = await fetch('http://localhost:5000/api/productos', {
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

  const manejarReabastecer = async (id_insumo) => {
    const cantidad = cantidadReabastecer[id_insumo];
    if (!cantidad || cantidad <= 0) return alert("Ingresa una cantidad válida");

    try {
      const respuesta = await fetch(`http://localhost:5000/api/inventario/${id_insumo}/reabastecer`, {
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
  }, []);

  useEffect(() => {
    if (pantalla === 'cocina') cargarOrdenesCocina();

    socket.on('nueva_orden_creada', (data) => {
      sonidoCampana.play();
      if (pantalla === 'cocina') cargarOrdenesCocina();
    });

    return () => socket.off('nueva_orden_creada');
  }, [pantalla]);


  // ==========================================
  // RENDER DE PANTALLAS
  // ==========================================
  if (pantalla === 'inicio') {
    return (
      <div className="h-screen w-full bg-yellow-400 flex flex-col items-center justify-center p-4">
        <motion.h1 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="text-6xl md:text-8xl font-black text-purple-800 mb-16 drop-shadow-xl text-center">
          🕹️ Postres Arcade
        </motion.h1>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { cambiarPantalla('menu'); setCarrito([]); }} className="bg-purple-600 text-white text-4xl md:text-5xl font-bold py-8 px-16 rounded-3xl shadow-[0_12px_0_0_rgba(88,28,135,1)] active:translate-y-3 transition-all">
          ¡TOCAR PARA PEDIR!
        </motion.button>
        <div className="flex gap-4 mt-12">
          <button onClick={() => cambiarPantalla('cocina')} className="bg-gray-800 text-gray-400 font-bold py-2 px-6 rounded-full opacity-50 hover:opacity-100">👨‍🍳 Modo Cocina</button>
          <button onClick={() => { cambiarPantalla('dashboard'); cargarDashboard(); }} className="bg-blue-900 text-blue-300 font-bold py-2 px-6 rounded-full opacity-50 hover:opacity-100">📊 Panel Dueño</button>
        </div>
      </div>
    );
  }

  if (pantalla === 'exito') {
    return (
      <div className="h-screen w-full bg-green-500 flex flex-col items-center justify-center p-4">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", bounce: 0.6 }} className="text-9xl mb-8">🎉</motion.div>
        <h2 className="text-6xl md:text-8xl font-black text-white mb-4 drop-shadow-xl text-center">¡ORDEN RECIBIDA!</h2>
        <div className="bg-white text-green-700 text-5xl font-black py-4 px-10 rounded-2xl shadow-xl mb-12">TU TICKET ES: #{ticketActual}</div>
        <p className="text-3xl text-green-100 font-bold mb-16">Pasa a la barra con este número.</p>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => cambiarPantalla('inicio')} className="bg-white text-green-600 text-3xl font-bold py-6 px-12 rounded-3xl shadow-[0_12px_0_0_rgba(20,83,45,1)] active:translate-y-3 transition-all">
          Finalizar y Volver
        </motion.button>
      </div>
    );
  }

  if (pantalla === 'dashboard') {
    return (
      <div className="h-screen w-full bg-slate-900 p-8 overflow-y-auto font-sans flex flex-col md:flex-row gap-8">
        
        {/* COLUMNA IZQUIERDA: MÉTRICAS Y NUEVO PRODUCTO */}
        <div className="w-full md:w-1/3 flex flex-col gap-6">
          <div className="flex justify-between items-center border-b-2 border-slate-700 pb-4">
            <h2 className="text-3xl font-black text-white tracking-wide">📈 ADMIN</h2>
            <button onClick={() => cambiarPantalla('inicio')} className="bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600">Volver</button>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-6 shadow-lg text-white">
            <h3 className="text-xl font-bold opacity-80 mb-1">INGRESOS TOTALES</h3>
            <p className="text-5xl font-black">${datosDashboard.ventas_totales.toFixed(2)}</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 shadow-lg text-white">
            <h3 className="text-xl font-bold opacity-80 mb-1">ÓRDENES COMPLETADAS</h3>
            <p className="text-5xl font-black">{datosDashboard.total_ordenes}</p>
          </div>

          {/* FORMULARIO CREAR POSTRE */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mt-4">
            <h3 className="text-xl font-bold text-white mb-4">🍩 Agregar al Menú</h3>
            <form onSubmit={manejarCrearProducto} className="flex flex-col gap-4">
              <input 
                type="text" placeholder="Nombre (ej. Malteada)" 
                value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({...nuevoProducto, nombre: e.target.value})}
                className="bg-slate-700 text-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input 
                type="number" placeholder="Precio ($)" 
                value={nuevoProducto.precio} onChange={(e) => setNuevoProducto({...nuevoProducto, precio: e.target.value})}
                className="bg-slate-700 text-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button type="submit" className="bg-purple-600 text-white font-bold py-3 rounded-xl shadow-[0_4px_0_0_rgba(88,28,135,1)] active:translate-y-1 transition-all">
                Guardar Postre
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA: INVENTARIO */}
        <div className="w-full md:w-2/3 flex flex-col">
          <h3 className="text-2xl font-bold text-slate-300 mb-6 flex items-center mt-2">
            📦 Almacén y Reabastecimiento
            <button onClick={() => { sonidoBoton.play(); cargarDashboard(); }} className="ml-4 text-sm bg-slate-800 py-1 px-3 rounded-full hover:bg-slate-700 text-white">🔄 Actualizar</button>
          </h3>
          
          <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-xl flex-1">
            <table className="w-full text-left text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase text-sm">
                <tr>
                  <th className="px-6 py-4 font-bold">Insumo</th>
                  <th className="px-6 py-4 font-bold text-center">Stock Actual</th>
                  <th className="px-6 py-4 font-bold">Ingreso (Proveedor)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {datosDashboard.inventario.map(item => (
                  <tr key={item.id} className="hover:bg-slate-750">
                    <td className="px-6 py-4 font-semibold text-white">
                      {item.nombre}
                      {item.stock < 500 && <span className="ml-2 bg-red-900 text-red-400 py-0.5 px-2 rounded-full text-xs font-bold">BAJO</span>}
                    </td>
                    <td className="px-6 py-4 font-black text-center text-xl text-white">
                      {item.stock} <span className="text-sm font-normal text-slate-500">{item.unidad}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <input 
                          type="number" placeholder="Cant." min="1"
                          value={cantidadReabastecer[item.id] || ''}
                          onChange={(e) => setCantidadReabastecer({...cantidadReabastecer, [item.id]: e.target.value})}
                          className="w-20 bg-slate-700 text-white p-2 rounded-lg outline-none text-center"
                        />
                        <button 
                          onClick={() => manejarReabastecer(item.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-500 active:bg-green-700"
                        >
                          ➕ Sumar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  }

  if (pantalla === 'cocina') {
    return (
      <div className="h-screen w-full bg-gray-900 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-10 border-b-4 border-gray-700 pb-6">
          <h2 className="text-5xl font-black text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">🔥 MISIONES ACTIVAS (COCINA)</h2>
          <button onClick={() => cambiarPantalla('inicio')} className="bg-red-600 text-white font-bold py-3 px-6 rounded-xl shadow-[0_6px_0_0_rgba(153,27,27,1)] active:translate-y-1">Salir</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ordenesCocina.length === 0 ? (
            <h3 className="text-3xl text-gray-500 font-bold col-span-full text-center mt-20">No hay misiones activas. ¡Esperando pedidos!</h3>
          ) : (
            <AnimatePresence>
              {ordenesCocina.map((orden) => (
                <motion.div key={orden.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="bg-gray-800 rounded-3xl p-6 border-4 border-orange-500 flex flex-col justify-between shadow-[0_0_20px_rgba(249,115,22,0.3)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 bg-orange-500 text-white font-black text-xl px-4 py-1 rounded-br-2xl">TICKET #{orden.id}</div>
                  <div className="mt-10 mb-6 space-y-3">
                    {orden.detalles.map((item, index) => (
                      <div key={index} className="flex items-center text-2xl text-white bg-gray-700 p-3 rounded-xl">
                        <span className="font-black text-orange-400 mr-4">x{item.cantidad}</span><span className="font-bold">{item.nombre}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => completarOrden(orden.id)} className="w-full bg-green-500 text-white text-2xl font-black py-4 rounded-xl shadow-[0_6px_0_0_rgba(21,128,61,1)] active:translate-y-2">¡ORDEN LISTA! 🛎️</button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    );
  }

  // default: MENU Y CARRITO
  return (
    <div className="h-screen w-full flex bg-blue-50 overflow-hidden">
      <div className="w-2/3 p-8 overflow-y-auto">
        <h2 className="text-5xl font-black text-blue-900 mb-10 drop-shadow-md">ELIGE TU POSTRE 🍰</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {productos.map(producto => (
            <motion.div key={producto.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => agregarAlCarrito(producto)} className="bg-white rounded-3xl p-6 flex flex-col items-center justify-between border-4 border-gray-200 shadow-[0_8px_0_0_rgba(209,213,219,1)] cursor-pointer select-none">
              <div className="text-7xl mb-4">{producto.nombre.includes('Frappé') || producto.nombre.includes('Malteada') ? '🥤' : '🎂'}</div>
              <h3 className="text-2xl font-bold text-center text-gray-800 mb-4">{producto.nombre}</h3>
              <div className="bg-green-500 text-white text-2xl font-black py-2 px-6 rounded-xl shadow-[0_4px_0_0_rgba(21,128,61,1)]">${producto.precio.toFixed(2)}</div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="w-1/3 bg-white border-l-8 border-gray-200 p-6 flex flex-col shadow-2xl relative z-10">
        <h2 className="text-4xl font-black text-gray-800 mb-6 border-b-4 border-gray-100 pb-4">TU ORDEN 📋</h2>
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {carrito.length === 0 ? <p className="text-xl text-gray-400 font-bold text-center mt-10">Aún no hay postres en tu orden.</p> : (
            <AnimatePresence>
              {carrito.map((item, index) => (
                <motion.div key={index} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                  <div className="flex flex-col"><span className="font-bold text-xl text-gray-800">{item.nombre}</span><span className="text-gray-500 font-semibold">x {item.cantidad}</span></div>
                  <span className="font-black text-xl text-purple-700">${(item.precio * item.cantidad).toFixed(2)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
        <div className="pt-6 border-t-4 border-gray-100 mt-4">
          <div className="flex justify-between items-center mb-6"><span className="text-2xl font-bold text-gray-600">TOTAL:</span><span className="text-4xl font-black text-green-600">${totalOrden.toFixed(2)}</span></div>
          <motion.button onClick={enviarOrden} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} disabled={carrito.length === 0} className={`w-full text-white text-3xl font-black py-6 rounded-2xl shadow-[0_8px_0_0_rgba(0,0,0,0.2)] active:translate-y-2 transition-all duration-75 ${carrito.length === 0 ? 'bg-gray-300 shadow-[0_8px_0_0_rgba(156,163,175,1)] cursor-not-allowed' : 'bg-green-500 shadow-[0_8px_0_0_rgba(21,128,61,1)]'}`}>
            CONFIRMAR ORDEN ✅
          </motion.button>
          <button onClick={() => cambiarPantalla('inicio')} className="w-full mt-6 bg-red-100 text-red-600 text-xl font-bold py-3 rounded-xl active:bg-red-200 transition-colors">Cancelar y volver</button>
        </div>
      </div>
    </div>
  );
}

export default App;