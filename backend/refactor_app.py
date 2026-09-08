import re

file_path = r"c:\Users\Israel\sistema-postres\frontend\src\App.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add API_URL at the top
content = content.replace(
    "const socket = io('http://localhost:5000');",
    "const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';\nconst socket = io(API_URL);"
)

# 2. Replace fetch hardcoded URLs
content = content.replace("'http://localhost:5000/api", "`${API_URL}/api")

# 3. Add conectado state
content = content.replace(
    "const [ticketActual, setTicketActual] = useState(null);",
    "const [ticketActual, setTicketActual] = useState(null);\n  const [conectado, setConectado] = useState(true);"
)

# 4. Add socket connect/disconnect listeners
socket_useEffect = """  useEffect(() => {
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
  }, [pantalla]);"""

# Replace the old useEffect for socket
old_socket_useEffect = re.search(r"  useEffect\(\(\) => \{\n    if \(pantalla === 'cocina'\) cargarOrdenesCocina\(\);\n\n    socket\.on\('nueva_orden_creada'.*?\n    \}\);\n\n    return \(\) => socket\.off\('nueva_orden_creada'\);\n  \}, \[pantalla\]\);", content, re.DOTALL)
if old_socket_useEffect:
    content = content.replace(old_socket_useEffect.group(0), socket_useEffect)
else:
    print("Warning: Could not find old socket useEffect")

# 5. Add offline banner to 'inicio' screen
inicio_banner = """        </div>
        {!conectado && (
          <div className="absolute top-4 bg-red-600 text-white font-bold py-2 px-6 rounded-full animate-pulse shadow-lg text-xl z-50">
            🔴 Sin conexión con el servidor
          </div>
        )}
      </div>"""
content = content.replace("        </div>\n      </div>", inicio_banner, 1)

# Add offline banner to 'menu' screen (the default return)
menu_banner = """  return (
    <div className="h-screen w-full flex bg-blue-50 overflow-hidden relative">
        {!conectado && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white font-bold py-2 px-6 rounded-full animate-pulse shadow-lg text-xl z-50">
            🔴 Sin conexión con el servidor
          </div>
        )}"""
content = content.replace('  return (\n    <div className="h-screen w-full flex bg-blue-50 overflow-hidden">', menu_banner)


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("App.jsx updated successfully.")
