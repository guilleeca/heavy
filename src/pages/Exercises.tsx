import { useNavigate } from 'react-router'
import { ExerciseBrowser } from '../components/ExerciseBrowser'
import { PageHeader } from '../components/ui'

/** Biblioteca de ejercicios (Perfil → Ejercicios). */
export function Exercises() {
  const navigate = useNavigate()
  return (
    <>
      <PageHeader
        title="Ejercicios"
        right={
          <button className="text-btn" onClick={() => navigate('/ejercicios/nuevo')}>
            Crear
          </button>
        }
      />
      <ExerciseBrowser onSelect={(ex) => navigate(`/ejercicio/${encodeURIComponent(ex.id)}`)} />
    </>
  )
}
