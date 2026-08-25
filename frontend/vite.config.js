import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Esto nos permite probar la PWA en el entorno de desarrollo local
      devOptions: {
        enabled: true 
      },
      manifest: {
        name: 'Postres Arcade POS',
        short_name: 'PostresArcade',
        description: 'Punto de venta y KDS para kiosco de postres',
        theme_color: '#facc15', // El color amarillo de tu pantalla de inicio
        background_color: '#facc15',
        display: 'fullscreen', // ¡La magia que oculta el navegador!
        orientation: 'landscape', // Fuerza a la tablet a mantenerse horizontal
        icons: [
          {
            // Un ícono de maquinita temporal sacado de internet para que funcione la instalación
            src: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png', 
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})