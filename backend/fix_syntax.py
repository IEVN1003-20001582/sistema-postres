import re

file_path = r"c:\Users\Israel\sistema-postres\frontend\src\App.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the broken backtick/single quote literals
content = content.replace("`${API_URL}/api/productos')", "`${API_URL}/api/productos`)")
content = content.replace("`${API_URL}/api/ordenes', {", "`${API_URL}/api/ordenes`, {")
content = content.replace("`${API_URL}/api/ordenes/pendientes')", "`${API_URL}/api/ordenes/pendientes`)")
content = content.replace("`${API_URL}/api/dashboard')", "`${API_URL}/api/dashboard`)")
content = content.replace("`${API_URL}/api/productos', {", "`${API_URL}/api/productos`, {")

# Fix the ones that were completely missed by the first script because they were already using backticks
content = content.replace("`http://localhost:5000/api/ordenes/${id}/completar`", "`${API_URL}/api/ordenes/${id}/completar`")
content = content.replace("`http://localhost:5000/api/inventario/${id_insumo}/reabastecer`", "`${API_URL}/api/inventario/${id_insumo}/reabastecer`")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Syntax fixed!")
