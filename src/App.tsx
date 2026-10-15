import { createHashRouter, RouterProvider } from 'react-router'
import { useAuth } from './auth/context'
import { Layout } from './components/Layout'
import { Feed } from './pages/Feed'
import { Login } from './pages/Login'
import { Profile } from './pages/Profile'
import { Workout } from './pages/Workout'
import { Exercises } from './pages/Exercises'
import { ExerciseDetail } from './pages/ExerciseDetail'
import { NewExercise } from './pages/NewExercise'
import { RoutineDetail } from './pages/RoutineDetail'
import { RoutineEditor } from './pages/RoutineEditor'
import { Explore } from './pages/Explore'
import { DataProvider } from './data/DataProvider'

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
  // Pantallas completas (sin barra de pestañas)
  { path: '/ejercicios', element: <Exercises /> },
  { path: '/ejercicios/nuevo', element: <NewExercise /> },
  { path: '/ejercicio/:id', element: <ExerciseDetail /> },
  { path: '/rutina/nueva', element: <RoutineEditor /> },
  { path: '/rutina/:id', element: <RoutineDetail /> },
  { path: '/rutina/:id/editar', element: <RoutineEditor /> },
  { path: '/explorar', element: <Explore /> },
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
  return session ? (
    <DataProvider>
      <RouterProvider router={router} />
    </DataProvider>
  ) : (
    <Login />
  )
}
