import type { Exercise, ExerciseType } from './exercises'
import type { RoutineSet, SetType } from './routines'
import type { Kind, TrackPoint } from './gpx'

/* ---------- Entreno guardado (Supabase) ---------- */

export type WorkoutSet = {
  type: SetType
  weight: number | null
  reps: number | null
  duration: number | null
  /** Esfuerzo percibido (6–10) */
  rpe?: number | null
  /** Récords batidos en esta serie */
  prs?: string[]
}

export type WorkoutExercise = {
  exerciseId: string
  notes: string
  sets: WorkoutSet[]
  /** Ejercicios con el mismo id forman una superserie */
  supersetId?: string | null
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
  /** Gimnasio o actividad con recorrido (GPX) */
  kind?: Kind
  distance_m?: number | null
  elevation_gain_m?: number | null
  moving_s?: number | null
  track?: TrackPoint[] | null
}

export const isActivity = (w: Pick<Workout, 'kind'>) => !!w.kind && w.kind !== 'gym'

/* ---------- Entreno en curso (solo en el móvil hasta terminar) ---------- */

export type LiveSet = {
  key: string
  type: SetType
  weight: number | null
  reps: number | null
  duration: number | null
  done: boolean
  rpe?: number | null
  /** Récords batidos al marcarla (medalla) */
  prs?: string[]
  /** Objetivo de la rutina (se muestra en gris si no hay anterior) */
  target?: Pick<RoutineSet, 'weight' | 'reps' | 'repsMax' | 'duration'>
}

export type LiveExercise = {
  key: string
  exerciseId: string
  notes: string
  restSeconds: number
  sets: LiveSet[]
  supersetId?: string | null
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
export function newRecords(done: Workout, history: Workout[], find: (id: string) => Exercise | undefined): Record[] {
  const out: Record[] = []
  const before = history.filter((w) => w.user_id === done.user_id && w.id !== done.id && w.started_at < done.started_at)
  for (const e of done.exercises) {
    const ex = find(e.exerciseId)
    const type = ex?.type ?? 'weight_reps'
    const work = e.sets.filter((s) => s.type !== 'warmup')
    const old = before
      .flatMap((w) => w.exercises.filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.sets))
      .filter((s) => s.type !== 'warmup')
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

/** Récords que bate una serie al marcarla (frente al historial y a las series ya hechas hoy) */
export function setPrs(
  set: Pick<WorkoutSet, 'weight' | 'reps' | 'duration' | 'type'>,
  type: ExerciseType,
  history: WorkoutSet[],
  today: WorkoutSet[],
): Record[] {
  if (set.type === 'warmup') return []
  const old = history.filter((s) => s.type !== 'warmup')
  // Sin historial no hay récord (como Hevy: la primera vez no cuenta)
  if (!old.length) return []
  const base = [...old, ...today.filter((s) => s.type !== 'warmup')]
  const out: Record[] = []
  const w = set.weight ?? 0
  const r = set.reps ?? 0
  if (type === 'weight_reps') {
    if (w <= 0 || r <= 0) return []
    if (w > Math.max(...base.map((s) => s.weight ?? 0))) out.push({ exerciseId: '', label: 'Peso máximo', value: `${fmtKg(w)} kg` })
    const orm = oneRepMax(w, r)
    if (orm > Math.max(...base.map((s) => oneRepMax(s.weight ?? 0, s.reps ?? 0))) + 0.01)
      out.push({ exerciseId: '', label: '1RM estimado', value: `${fmtKg(orm)} kg` })
    if (w * r > Math.max(...base.map((s) => (s.weight ?? 0) * (s.reps ?? 0))))
      out.push({ exerciseId: '', label: 'Mejor serie', value: `${fmtKg(w)} kg × ${r}` })
  } else if (type === 'duration') {
    const d = set.duration ?? 0
    if (d > 0 && d > Math.max(...base.map((s) => s.duration ?? 0))) out.push({ exerciseId: '', label: 'Mayor duración', value: fmtClock(d) })
  } else if (r > 0 && r > Math.max(...base.map((s) => s.reps ?? 0))) {
    out.push({ exerciseId: '', label: 'Más repeticiones', value: `${r} reps` })
  }
  return out
}

/* ---------- formato ---------- */

export const fmtKg = (n: number) => (Math.round(n * 100) / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })

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
  const rpe = s.rpe ? ` · RPE ${fmtRpe(s.rpe)}` : ''
  if (type === 'duration') return (s.duration != null ? fmtClock(s.duration) : '—') + rpe
  if (type === 'reps') return (s.reps != null ? `${s.reps} reps` : '—') + rpe
  if (type === 'assisted') return `-${fmtKg(s.weight ?? 0)} kg × ${s.reps ?? 0}${rpe}`
  return `${fmtKg(s.weight ?? 0)} kg × ${s.reps ?? 0}${rpe}`
}

export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
export const fmtRpe = (v: number) => String(v).replace('.', ',')

/* ---------- superseries ---------- */

/** Colores de las superseries (por orden de aparición) */
export const SUPERSET_COLORS = ['#a78bfa', '#f59e0b', '#22d3ee', '#f472b6', '#84cc16', '#fb7185']

/** Superseries de verdad (2 ejercicios o más): id → número 0, 1, 2… por orden */
export function supersetIndex(list: { supersetId?: string | null }[]) {
  const count = new Map<string, number>()
  for (const e of list) if (e.supersetId) count.set(e.supersetId, (count.get(e.supersetId) ?? 0) + 1)
  const out = new Map<string, number>()
  for (const e of list) if (e.supersetId && (count.get(e.supersetId) ?? 0) > 1 && !out.has(e.supersetId)) out.set(e.supersetId, out.size)
  return out
}

export const supersetLetter = (i: number) => String.fromCharCode(65 + (i % 26))

/** Une el ejercicio `other` a la superserie de `ei` (lo coloca justo detrás del grupo) */
export function joinSuperset<T extends { supersetId?: string | null }>(list: T[], ei: number, other: number, newId: string): T[] {
  const base = list[ei]
  const id = base.supersetId ?? newId
  const otherOld = list[other].supersetId
  // Se mueve el otro ejercicio (y su grupo, si tenía) justo detrás del grupo de `ei`
  const moving = (e: T, i: number) => i === other || (!!otherOld && otherOld !== id && e.supersetId === otherOld)
  const stay = list.map((e, i) => ({ e: i === ei ? { ...e, supersetId: id } : e, i })).filter(({ e, i }) => !moving(e, i))
  const moved = list.filter(moving).map((e) => ({ ...e, supersetId: id }))
  const out = stay.map((x) => x.e)
  let at = -1
  out.forEach((e, i) => e.supersetId === id && (at = i))
  return [...out.slice(0, at + 1), ...moved, ...out.slice(at + 1)]
}

/** Saca un ejercicio de su superserie (si queda uno solo, el grupo desaparece) */
export function leaveSuperset<T extends { supersetId?: string | null }>(list: T[], ei: number): T[] {
  const id = list[ei].supersetId
  if (!id) return list
  const left = list.filter((e, i) => i !== ei && e.supersetId === id).length
  return list.map((e, i) => (i === ei || (left < 2 && e.supersetId === id) ? { ...e, supersetId: null } : e))
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
