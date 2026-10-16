import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // La app se publica en https://guilleeca.github.io/heavy/
  base: '/heavy/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // El registro se hace en src/main.tsx para buscar actualizaciones al volver a la app
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Heavy',
        short_name: 'Heavy',
        description: 'Entrenos de gimnasio, carreras y rutas.',
        lang: 'es',
        start_url: '/heavy/',
        scope: '/heavy/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        // Aparece en el menú "Compartir" de Android para recibir GPX/TCX, fotos y enlaces de Strava
        share_target: {
          action: '/heavy/compartir',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'file',
                accept: [
                  '.gpx',
                  '.tcx',
                  'application/gpx+xml',
                  'application/gpx',
                  'application/vnd.garmin.tcx+xml',
                  'application/xml',
                  'text/xml',
                  'application/octet-stream',
                  // Fotos para añadirlas a un entreno o actividad
                  'image/*',
                ],
              },
            ],
          },
        },
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Botones de la notificación del entreno y "Compartir con Heavy"
        importScripts: ['notifications-sw.js', 'share-sw.js'],
        navigateFallback: '/heavy/index.html',
        runtimeCaching: [
          {
            // Animaciones de ExerciseDB: se guardan para usarlas sin conexión
            urlPattern: ({ url }) => url.hostname === 'static.exercisedb.dev',
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-gifs',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Teselas del mapa (OpenStreetMap): las ya vistas cargan al momento
            urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
