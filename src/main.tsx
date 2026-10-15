import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router'
import '@fontsource-variable/inter'
import './styles/theme.css'
import { Layout } from './components/Layout'
import { Feed } from './pages/Feed'
import { Workout } from './pages/Workout'
import { Profile } from './pages/Profile'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
