import { useNavigate } from 'react-router'
import { CustomExerciseForm } from '../components/CustomExerciseForm'

export function NewExercise() {
  const navigate = useNavigate()
  return (
    <CustomExerciseForm
      onCancel={() => navigate(-1)}
      onSaved={(id) => navigate(`/ejercicio/${encodeURIComponent(id)}`, { replace: true })}
    />
  )
}
