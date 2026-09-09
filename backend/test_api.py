import urllib.request
import json

url = "https://sistema-postres.onrender.com/api/dashboard?filtro=hoy"
try:
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req) as response:
        print("Status:", response.getcode())
        print("Response:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Response:", e.read().decode('utf-8'))
except Exception as e:
    print("Error:", str(e))
