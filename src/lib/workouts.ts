import type { Exercise, ExerciseType } from './exercises'
import type { RoutineSet, SetType } from './routines'

/* ---------- Entreno guardado (Supabase) ---------- */

export type WorkoutSet = {
  type: SetType
  weight: number | null
  reps: number | null
  duration: number | null
}

export type WorkoutExercise = {
  exerciseId: string
  notes: string
  sets: WorkoutSet[]
}

export type Workout = {
  id: string
  user_id: string
  routine_id: string | null
  title: string
  description: string
  started_at: string
  ended_at: string
  duration_s: number
  volume_kg: number
  sets_count: number
  exercises: WorkoutExercise[]
  photos: string[]
  visibility: 'everyone' | 'private'
}

/* ---------- Entreno en curso (solo en el móvil hasta terminar) ---------- */

export type LiveSet = {
  key: string
  type: SetType
  weight: number | null
  reps: number | null
  duration: number | null
  done: boolean
  /** Objetivo de la rutina (se muestra en gris si no hay anterior) */
  target?: Pick<RoutineSet, 'weight' | 'reps' | 'repsMax' | 'duration'>
}

export type LiveExercise = {
  key: string
  exerciseId: string
  notes: string
  restSeconds: number
  sets: LiveSet[]
}

export type ActiveWorkout = {
  id: string
  title: string
  routineId: string | null
  startedAt: number
  exercises: LiveExercise[]
  rest: { endsAt: number; total: number } | null
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))

export function defaultTitle(date = new Date()) {
  const h = date.getHours()
  if (h < 6) return 'Entreno de madrugada'
  if (h < 12) return 'Entreno de mañana'
  if (h < 15) return 'Entreno de mediodía'
  if (h < 21) return 'Entreno de tarde'
  return 'Entreno de noche'
}

/** Peso efectivo: lo escrito o, si está vacío, lo anterior/objetivo */
export function effective(set: LiveSet, prev?: WorkoutSet) {
  return {
    weight: set.weight ?? prev?.weight ?? set.target?.weight ?? null,
    reps: set.reps ?? prev?.reps ?? set.target?.reps ?? null,
    duration: set.duration ?? prev?.duration ?? set.target?.duration ?? null,
  }
}

export function setVolume(s: Pick<WorkoutSet, 'weight' | 'reps' | 'type'>, type: ExerciseType) {
  if (s.type === 'warmup' || type !== 'weight_reps') return 0
  return (s.weight ?? 0) * (s.reps ?? 0)
}

export function workoutVolume(exercises: { exerciseId: string; sets: WorkoutSet[] }[], find: (id: string) => Exercise | undefined) {
  let v = 0
  for (const e of exercises) {
    const t = find(e.exerciseId)?.type ?? 'weight_reps'
    for (const s of e.sets) v += setVolume(s, t)
  }
  return Math.round(v)
}

/** 1RM estimado (Epley) */
export const oneRepMax = (w: number, r: number) => (r <= 0 || w <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30))

/** Último entreno en el que aparece el ejercicio (series de la vez anterior) */
export function previousSets(workouts: Workout[], userId: string, exerciseId: string): WorkoutSet[] {
  for (const w of workouts) {
    if (w.user_id !== userId) continue
    const e = w.exercises.find((x) => x.exerciseId === exerciseId)
    if (e && e.sets.length) return e.sets
  }
  return []
}

export type Record = { exerciseId: string; label: string; value: string }

/** Récords nuevos de un entreno frente a todo el historial anterior */
export function newRecords(
  done: Workout,
  history: Workout[],
  find: (id: string) => Exercise | undefined,
): Record[] {
  const out: Record[] = []
  const before = history.filter((w) => w.user_id === done.user_id && w.id !== done.id && w.started_at < done.started_at)
  for (const e of done.exercises) {
    const ex = find(e.exerciseId)
    const type = ex?.type ?? 'weight_reps'
    const work = e.sets.filter((s) => s.type !== 'warmup')
    const old = before.flatMap((w) => w.exercises.filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.sets)).filter((s) => s.type !== 'warmup')
    if (!work.length || !old.length) continue
    if (type === 'weight_reps') {
      const maxW = Math.max(...work.map((s) => s.weight ?? 0))
      const oldW = Math.max(...old.map((s) => s.weight ?? 0))
      if (maxW > oldW) out.push({ exerciseId: e.exerciseId, label: 'Peso máximo', value: `${fmtKg(maxW)} kg` })
      const best1 = Math.max(...work.map((s) => oneRepMax(s.weight ?? 0, s.reps ?? 0)))
      const old1 = Math.max(...old.map((s) => oneRepMax(s.weight ?? 0, s.reps ?? 0)))
      if (best1 > old1 + 0.01) out.push({ exerciseId: e.exerciseId, label: '1RM estimado', value: `${fmtKg(best1)} kg` })
      const bestV = Math.max(...work.map((s) => (s.weight ?? 0) * (s.reps ?? 0)))
      const oldV = Math.max(...old.map((s) => (s.weight ?? 0) * (s.reps ?? 0)))
      if (bestV > oldV) out.push({ exerciseId: e.exerciseId, label: 'Mejor volumen en una serie', value: `${fmtKg(bestV)} kg` })
    } else if (type === 'duration') {
      const best = Math.max(...work.map((s) => s.duration ?? 0))
      if (best > Math.max(...old.map((s) => s.duration ?? 0))) out.push({ exerciseId: e.exerciseId, label: 'Mayor duración', value: fmtClock(best) })
    } else {
      const best = Math.max(...work.map((s) => s.reps ?? 0))
      if (best > Math.max(...old.map((s) => s.reps ?? 0))) out.push({ exerciseId: e.exerciseId, label: 'Más repeticiones', value: `${best} reps` })
    }
  }
  return out
}

/* ---------- formato ---------- */

export const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })

/** 1:05:09 / 23:41 */
export function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** "1h 5min", "47min" */
export function fmtDuration(totalSeconds: number) {
  const m = Math.round(totalSeconds / 60)
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h ${m % 60}min`
}

export function fmtVolume(kg: number) {
  return `${Math.round(kg).toLocaleString('es-ES')} kg`
}

export function fmtSet(s: WorkoutSet, type: ExerciseType) {
  if (type === 'duration') return s.duration != null ? fmtClock(s.duration) : '—'
  if (type === 'reps') return s.reps != null ? `${s.reps} reps` : '—'
  if (type === 'assisted') return `-${fmtKg(s.weight ?? 0)} kg × ${s.reps ?? 0}`
  return `${fmtKg(s.weight ?? 0)} kg × ${s.reps ?? 0}`
}

/** "Ayer a las 10:56", "hoy a las 18:20", "14 oct a las 9:02" */
export function fmtWhen(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (diff === 0) return `Hoy a las ${time}`
  if (diff === 1) return `Ayer a las ${time}`
  return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} a las ${time}`
}
