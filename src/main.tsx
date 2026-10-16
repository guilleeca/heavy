import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles/theme.css'
import './pages/Login.css'
import { App } from './App'
import { AuthProvider } from './auth/AuthProvider'
import { registerSW } from 'virtual:pwa-register'

// Actualizaciones: al publicar una versión nueva, la app se recarga sola con ella.
// Se comprueba al abrirla, al volver a ella desde segundo plano y cada 30 minutos.
// (El entreno en curso está guardado, así que una recarga no pierde nada.)
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => {
      if (navigator.onLine) void registration.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    window.setInterval(check, 30 * 60 * 1000)
  },
})

// Al tocar una notificación push con la app abierta, se va a esa pantalla
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'heavy-open' && typeof e.data.url === 'string') window.location.hash = e.data.url.replace(/^#/, '')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
