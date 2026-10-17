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

/* ---------- ¿El entreno se ha salido de la rutina? ---------- */

type Performed = { exerciseId: string; notes: string; restSeconds: number; supersetId?: string | null; sets: { type: SetType; done: boolean }[] }

/** Cambios de estructura (ejercicios, orden, series, tipos, descansos, superseries) entre la rutina y lo hecho */
export function routineChanges(routine: Routine, performed: Performed[]): string[] {
  const done = performed.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length > 0)
  const before = routine.exercises
  const out: string[] = []
  const ids = (l: { exerciseId: string }[]) => l.map((e) => e.exerciseId)
  const added = done.filter((e) => !before.some((b) => b.exerciseId === e.exerciseId)).length
  const removed = before.filter((b) => !done.some((e) => e.exerciseId === b.exerciseId)).length
  if (added) out.push(added === 1 ? '1 ejercicio nuevo' : `${added} ejercicios nuevos`)
  if (removed) out.push(removed === 1 ? '1 ejercicio sin hacer' : `${removed} ejercicios sin hacer`)
  const common = ids(done).filter((id) => before.some((b) => b.exerciseId === id))
  const commonBefore = ids(before).filter((id) => common.includes(id))
  if (common.join() !== commonBefore.join()) out.push('otro orden')
  let more = 0
  let less = 0
  let other = false
  for (const e of done) {
    const b = before.find((x) => x.exerciseId === e.exerciseId)
    if (!b) continue
    if (e.sets.length > b.sets.length) more += e.sets.length - b.sets.length
    if (e.sets.length < b.sets.length) less += b.sets.length - e.sets.length
    if (e.restSeconds !== b.restSeconds || e.sets.some((s, i) => b.sets[i] && b.sets[i].type !== s.type)) other = true
  }
  if (more) out.push(more === 1 ? '1 serie más' : `${more} series más`)
  if (less) out.push(less === 1 ? '1 serie menos' : `${less} series menos`)
  const groups = (l: { exerciseId: string; supersetId?: string | null }[]) => {
    const m = new Map<string, string[]>()
    for (const e of l) if (e.supersetId) m.set(e.supersetId, [...(m.get(e.supersetId) ?? []), e.exerciseId])
    return [...m.values()]
      .filter((g) => g.length > 1)
      .map((g) => g.join('+'))
      .sort()
      .join('|')
  }
  if (groups(done) !== groups(before)) out.push('superseries distintas')
  if (other && !out.length) out.push('descansos o tipos de serie')
  return out
}

/** Rutina nueva a partir de lo hecho: conserva los objetivos que ya tenía cada serie */
export function routineFromWorkout(routine: Routine, performed: Performed[]): RoutineExercise[] {
  return performed
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0)
    .map((e) => {
      const b = routine.exercises.find((x) => x.exerciseId === e.exerciseId)
      return {
        exerciseId: e.exerciseId,
        notes: e.notes || b?.notes || '',
        restSeconds: e.restSeconds,
        supersetId: e.supersetId ?? null,
        sets: e.sets.map((s, i) => {
          const t = b?.sets[i]
          return { type: s.type, weight: t?.weight ?? null, reps: t?.reps ?? null, repsMax: t?.repsMax ?? null, duration: t?.duration ?? null }
        }),
      }
    })
}
