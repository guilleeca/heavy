/* Heavy · notificaciones push (cuando el otro entrena, da me gusta o comenta).
   Se carga en el service worker (vite.config.ts → workbox.importScripts). */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Heavy', body: event.data ? event.data.text() : '' }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || 'Heavy', {
      body: data.body || '',
      icon: scope + 'pwa-192.png',
      badge: scope + 'pwa-192.png',
      tag: data.tag,
      renotify: true,
      data: { url: data.url || '' },
    }),
  )
})

// Al tocarla se abre Heavy en esa pantalla (las del entreno en curso las gestiona notifications-sw.js)
self.addEventListener('notificationclick', (event) => {
  const url = event.notification.data && event.notification.data.url
  if (typeof url !== 'string') return
  event.notification.close()
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope
      const target = scope + url
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const win = windows.find((w) => w.url.startsWith(scope))
      if (win) {
        await win.focus()
        win.postMessage({ type: 'heavy-open', url })
      } else {
        await self.clients.openWindow(target)
      }
    })(),
  )
})
