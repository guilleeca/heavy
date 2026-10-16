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
import { ImportHevy } from './pages/ImportHevy'
import { ImportActivity } from './pages/ImportActivity'
import { Statistics } from './pages/Statistics'
import { Calendar } from './pages/Calendar'
import { Measures } from './pages/Measures'
import { Explore } from './pages/Explore'
import { DataProvider } from './data/DataProvider'
import { SocialProvider } from './data/SocialProvider'
import { ActiveWorkoutProvider } from './workout/ActiveWorkoutProvider'
import { ActiveWorkout } from './pages/ActiveWorkout'
import { FinishWorkout } from './pages/FinishWorkout'
import { WorkoutDetail } from './pages/WorkoutDetail'
import { EditWorkout } from './pages/EditWorkout'
import { LiveView } from './pages/LiveView'

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
  { path: '/importar', element: <ImportHevy /> },
  { path: '/actividad/nueva', element: <ImportActivity /> },
  { path: '/estadisticas', element: <Statistics /> },
  { path: '/calendario', element: <Calendar /> },
  { path: '/medidas', element: <Measures /> },
  { path: '/entreno', element: <ActiveWorkout /> },
  { path: '/entreno/guardar', element: <FinishWorkout /> },
  { path: '/entreno/:id', element: <WorkoutDetail /> },
  { path: '/entreno/:id/editar', element: <EditWorkout /> },
  { path: '/en-directo/:userId', element: <LiveView /> },
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
      <SocialProvider>
        <ActiveWorkoutProvider>
          <RouterProvider router={router} />
        </ActiveWorkoutProvider>
      </SocialProvider>
    </DataProvider>
  ) : (
    <Login />
  )
}
