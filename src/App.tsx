import { createHashRouter, RouterProvider } from 'react-router'
import { useAuth } from './auth/context'
import { Layout } from './components/Layout'
import { Feed } from './pages/Feed'
import { Login } from './pages/Login'
import { Profile } from './pages/Profile'
import { Workout } from './pages/Workout'

// Rutas con "#" (p. ej. .../heavy/#/perfil): GitHub Pages solo sirve
// archivos estáticos y así recargar cualquier pantalla nunca da 404.
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Feed /> },
      { path: 'entrenamiento', element: <Workout /> },
      { path: 'perfil', element: <Profile /> },
    ],
  },
])

/** Sin sesión se muestra el login; con sesión, la app. */
export function App() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="splash">
        <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="Heavy" width={72} height={72} />
      </div>
    )
  }
  return session ? <RouterProvider router={router} /> : <Login />
}
