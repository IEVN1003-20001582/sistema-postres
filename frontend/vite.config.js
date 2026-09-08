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
            src: '/pwa-192x192.png', 
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png', 
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wav,ogg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
})