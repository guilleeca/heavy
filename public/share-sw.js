/* Heavy · "Compartir con Heavy" desde otras apps de Android (Web Share Target).
   Recibe un archivo GPX/TCX (o un enlace de Strava), lo guarda un momento
   y abre la pantalla "Nueva actividad". Se carga en el service worker
   (vite.config.ts → workbox.importScripts). */

const SHARE_CACHE = 'heavy-share'
const SHARED_FILE = 'shared-activity-file'

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/compartir')) return

  event.respondWith(
    (async () => {
      const scope = self.registration.scope
      try {
        const form = await event.request.formData()
        const file = form.get('file')
        if (file && typeof file !== 'string' && file.size > 0) {
          const cache = await caches.open(SHARE_CACHE)
          await cache.put(scope + SHARED_FILE, new Response(file, { headers: { 'x-file-name': encodeURIComponent(file.name || 'actividad.gpx') } }))
          return Response.redirect(scope + '#/actividad/nueva?compartido=1', 303)
        }
        // Enlace compartido desde la app de Strava
        const text = [form.get('url'), form.get('text'), form.get('title')].filter(Boolean).join(' ')
        return Response.redirect(scope + '#/actividad/nueva?enlace=' + encodeURIComponent(text.slice(0, 500)), 303)
      } catch {
        return Response.redirect(scope + '#/actividad/nueva', 303)
      }
    })(),
  )
})
