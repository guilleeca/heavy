import { useData } from '../data/context'
import { MUSCLE_LABEL, type Muscle } from '../lib/exercises'
import { setsByMuscle } from '../lib/stats'
import type { Workout } from '../lib/workouts'
import { BodyMap } from './BodyMap'
import { Sheet } from './ui'
import './MusclesSheet.css'

/** Músculos trabajados en un entreno: muñeco grande, series por músculo y qué ejercicios los trabajaron */
export function MusclesSheet({ workout, open, onClose }: { workout: Workout; open: boolean; onClose: () => void }) {
  const { findExercise } = useData()
  if (!open) return null
  const map = setsByMuscle([workout], findExercise)
  const ranked = (Object.entries(map) as [Muscle, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const max = ranked[0]?.[1] ?? 1
  const total = ranked.reduce((a, [, v]) => a + v, 0) || 1
  const weights = Object.fromEntries(ranked.map(([m, v]) => [m, Math.max(0.2, v / max)])) as Partial<Record<Muscle, number>>
  // Ejercicios de cada músculo (primero los que lo trabajan como principal)
  const byMuscle = (m: Muscle) => {
    const main: string[] = []
    const extra: string[] = []
    for (const e of workout.exercises) {
      const ex = findExercise(e.exerciseId)
      if (!ex) continue
      if (ex.muscle === m) main.push(ex.name)
      else if (ex.secondary.includes(m)) extra.push(ex.name)
    }
    return { main: [...new Set(main)], extra: [...new Set(extra)] }
  }
  const fmt = (v: number) => String(Math.round(v * 2) / 2).replace('.', ',')

  return (
    <Sheet open onClose={onClose} title="Músculos trabajados">
      <div className="ms">
        <BodyMap primary={[]} weights={weights} className="ms-body" />
        {ranked.length === 0 ? (
          <p className="ms-note">Este entreno no tiene ejercicios con músculos asignados.</p>
        ) : (
          <ul className="ms-list">
            {ranked.map(([m, v]) => {
              const ex = byMuscle(m)
              return (
                <li key={m}>
                  <div className="ms-row">
                    <b>{MUSCLE_LABEL[m]}</b>
                    <span className="ms-val tnum">
                      {fmt(v)} {v === 1 ? 'serie' : 'series'} · {Math.round((v / total) * 100)}%
                    </span>
                  </div>
                  <div className="ms-bar">
                    <i style={{ width: `${(v / max) * 100}%` }} />
                  </div>
                  <small>
                    {ex.main.join(', ')}
                    {ex.main.length > 0 && ex.extra.length > 0 && ' · '}
                    {ex.extra.length > 0 && <span className="ms-extra">{ex.extra.join(', ')}</span>}
                  </small>
                </li>
              )
            })}
          </ul>
        )}
        <p className="ms-note">Los músculos secundarios de cada ejercicio cuentan media serie (en gris en la lista).</p>
      </div>
    </Sheet>
  )
}
