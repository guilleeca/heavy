import type { Exercise, Muscle } from './exercises'

export type SetType = 'normal' | 'warmup' | 'failure' | 'drop'

export type RoutineSet = {
  type: SetType
  weight: number | null
  reps: number | null
  repsMax: number | null
  duration: number | null // segundos
}

export type RoutineExercise = {
  exerciseId: string
  notes: string
  restSeconds: number
  sets: RoutineSet[]
  supersetId?: string | null
}

export type Routine = {
  id: string
  user_id: string
  folder_id: string | null
  title: string
  notes: string
  exercises: RoutineExercise[]
  position: number
  created_at: string
  updated_at: string
}

export type Folder = {
  id: string
  user_id: string
  name: string
  position: number
}

export const SET_TYPE_LABEL: Record<SetType, string> = {
  normal: 'Serie normal',
  warmup: 'Serie de calentamiento',
  failure: 'Serie al fallo',
  drop: 'Drop set',
}

export const REST_OPTIONS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300]

export const newSet = (prev?: RoutineSet): RoutineSet =>
  prev
    ? { ...prev, type: prev.type === 'warmup' ? 'normal' : prev.type }
    : { type: 'normal', weight: null, reps: null, repsMax: null, duration: null }

export const newRoutineExercise = (exerciseId: string, rest = 90): RoutineExercise => ({
  exerciseId,
  notes: '',
  restSeconds: rest,
  sets: [newSet()],
})

/** "2min 30s", "45s", "Desactivado" */
export function formatRest(s: number) {
  if (!s) return 'Desactivado'
  const m = Math.floor(s / 60)
  const r = s % 60
  if (!m) return `${r}s`
  return r ? `${m}min ${r}s` : `${m}min`
}

/** Etiqueta de repeticiones: "8", "8-12" */
export function repsLabel(set: RoutineSet) {
  if (set.reps != null && set.repsMax != null && set.repsMax !== set.reps) return `${set.reps}-${set.repsMax}`
  if (set.reps != null) return String(set.reps)
  return null
}

/** Resumen de una línea, como Hevy: "3 series · 8-12 repeticiones" */
export function exerciseSummary(re: RoutineExercise) {
  const n = re.sets.length
  const labels = [...new Set(re.sets.map(repsLabel).filter(Boolean))]
  const reps = labels.length === 1 ? ` · ${labels[0]} repeticiones` : ''
  return `${n} ${n === 1 ? 'serie' : 'series'}${reps}`
}

/** Duración estimada: ~40 s por serie + su descanso */
export function estimateMinutes(r: Pick<Routine, 'exercises'>) {
  let s = 0
  for (const e of r.exercises) for (const _ of e.sets) s += 40 + e.restSeconds
  return Math.max(1, Math.round(s / 60))
}

export const totalSets = (r: Pick<Routine, 'exercises'>) => r.exercises.reduce((a, e) => a + e.sets.length, 0)

/** Series por músculo: principal cuenta 1, secundario 0,5 (como Hevy) */
export function setsByMuscle(r: Pick<Routine, 'exercises'>, find: (id: string) => Exercise | undefined) {
  const out = new Map<Muscle, number>()
  for (const re of r.exercises) {
    const ex = find(re.exerciseId)
    if (!ex) continue
    const n = re.sets.filter((s) => s.type !== 'warmup').length
    out.set(ex.muscle, (out.get(ex.muscle) ?? 0) + n)
    for (const m of ex.secondary) out.set(m, (out.get(m) ?? 0) + n * 0.5)
  }
  return [...out.entries()].filter(([m]) => m !== 'cardio' && m !== 'full_body').sort((a, b) => b[1] - a[1])
}
