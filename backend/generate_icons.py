import os
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    import sys
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
    from PIL import Image, ImageDraw, ImageFont

def generate_icon(size, filename):
    # Yellow background
    img = Image.new('RGB', (size, size), color='#facc15')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple arcade machine shape
    padding = size // 5
    # Main body
    draw.rectangle([padding, padding, size - padding, size - padding], fill='#581c87')
    # Screen
    screen_pad = padding + (size // 15)
    draw.rectangle([screen_pad, screen_pad, size - screen_pad, size // 2 + padding], fill='#0ea5e9')
    # Joystick and buttons
    draw.ellipse([size // 3, size // 2 + padding * 1.5, size // 3 + size // 15, size // 2 + padding * 1.5 + size // 15], fill='#ef4444')
    draw.ellipse([size - size // 3 - size // 15, size // 2 + padding * 1.5, size - size // 3, size // 2 + padding * 1.5 + size // 15], fill='#22c55e')
    
    img.save(filename)

generate_icon(192, r'c:\Users\Israel\sistema-postres\frontend\public\pwa-192x192.png')
generate_icon(512, r'c:\Users\Israel\sistema-postres\frontend\public\pwa-512x512.png')
print("Icons generated successfully.")
