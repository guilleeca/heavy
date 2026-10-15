import { useState } from 'react'
import { ExerciseBrowser } from './ExerciseBrowser'
import { CustomExerciseForm } from './CustomExerciseForm'
import { PageHeader } from './ui'
import './ExercisePicker.css'

/** Pantalla completa para elegir ejercicios (uno para sustituir, varios para añadir). */
export function ExercisePicker({
  single,
  onCancel,
  onDone,
}: {
  single?: boolean
  onCancel: () => void
  onDone: (ids: string[]) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  if (creating) {
    return (
      <div className="picker">
        <CustomExerciseForm
          onCancel={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false)
            if (single) onDone([id])
            else setPicked((p) => [...p, id])
          }}
        />
      </div>
    )
  }

  return (
    <div className="picker" role="dialog" aria-modal="true" aria-label={single ? 'Sustituir ejercicio' : 'Añadir ejercicios'}>
      <PageHeader
        title={single ? 'Sustituir ejercicio' : 'Añadir ejercicio'}
        left={
          <button className="text-btn" onClick={onCancel}>
            Cancelar
          </button>
        }
        right={
          <button className="text-btn" onClick={() => setCreating(true)}>
            Crear
          </button>
        }
      />
      <ExerciseBrowser
        picking
        selected={picked}
        onSelect={(ex) => {
          if (single) return onDone([ex.id])
          setPicked((p) => (p.includes(ex.id) ? p.filter((x) => x !== ex.id) : [...p, ex.id]))
        }}
      />
      {!single && picked.length > 0 && (
        <div className="picker-foot">
          <button className="btn btn-primary btn-block" onClick={() => onDone(picked)}>
            Añadir {picked.length} {picked.length === 1 ? 'ejercicio' : 'ejercicios'}
          </button>
        </div>
      )}
    </div>
  )
}
