/* Cálculos del perfil: progreso por ejercicio, récords, estadísticas por periodo y rachas. */

import type { Exercise, ExerciseType, Muscle } from './exercises'
import { oneRepMax, setVolume, type Workout, type WorkoutSet } from './workouts'

export type Session = {
  workout: Workout
  date: Date
  sets: WorkoutSet[]
  heaviest: number
  best1rm: number
  bestSetVolume: number
  volume: number
  reps: number
  maxReps: number
  maxDuration: number
}

/** Cada vez que se hizo el ejercicio, de más antigua a más reciente */
export function exerciseSessions(workouts: Workout[], userId: string, exerciseId: string, type: ExerciseType): Session[] {
  const out: Session[] = []
  for (const w of workouts) {
    if (w.user_id !== userId) continue
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets)
    if (!sets.length) continue
    const work = sets.filter((s) => s.type !== 'warmup')
    const list = work.length ? work : sets
    out.push({
      workout: w,
      date: new Date(w.started_at),
      sets,
      heaviest: Math.max(0, ...list.map((s) => s.weight ?? 0)),
      best1rm: Math.max(0, ...list.map((s) => oneRepMax(s.weight ?? 0, s.reps ?? 0))),
      bestSetVolume: Math.max(0, ...list.map((s) => (s.weight ?? 0) * (s.reps ?? 0))),
      volume: sets.reduce((a, s) => a + setVolume(s, type), 0),
      reps: list.reduce((a, s) => a + (s.reps ?? 0), 0),
      maxReps: Math.max(0, ...list.map((s) => s.reps ?? 0)),
      maxDuration: Math.max(0, ...list.map((s) => s.duration ?? 0)),
    })
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export type Best = { value: number; date: Date; workoutId: string }

const best = (sessions: Session[], key: keyof Pick<Session, 'heaviest' | 'best1rm' | 'bestSetVolume' | 'volume' | 'maxReps' | 'maxDuration' | 'reps'>): Best | null => {
  let b: Best | null = null
  for (const s of sessions) if (s[key] > 0 && (!b || s[key] > b.value)) b = { value: s[key], date: s.date, workoutId: s.workout.id }
  return b
}

export function exerciseRecords(sessions: Session[]) {
  // Mejor peso para cada número de repeticiones (como la tabla de récords de Hevy)
  const byReps = new Map<number, Best>()
  for (const s of sessions) {
    for (const set of s.sets) {
      if (set.type === 'warmup' || !set.reps || !set.weight) continue
      const cur = byReps.get(set.reps)
      if (!cur || set.weight > cur.value) byReps.set(set.reps, { value: set.weight, date: s.date, workoutId: s.workout.id })
    }
  }
  return {
    heaviest: best(sessions, 'heaviest'),
    best1rm: best(sessions, 'best1rm'),
    bestSetVolume: best(sessions, 'bestSetVolume'),
    bestSessionVolume: best(sessions, 'volume'),
    maxReps: best(sessions, 'maxReps'),
    bestSessionReps: best(sessions, 'reps'),
    maxDuration: best(sessions, 'maxDuration'),
    byReps: [...byReps.entries()].sort((a, b) => a[0] - b[0]),
  }
}

/* ---------- periodos ---------- */

export const PERIODS = [
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 },
  { key: '3m', label: '3 meses', days: 91 },
  { key: '1y', label: '1 año', days: 365 },
  { key: 'all', label: 'Todo', days: 0 },
] as const
export type PeriodKey = (typeof PERIODS)[number]['key']

export function inPeriod(workouts: Workout[], days: number, now: number, offset = 0) {
  if (!days) return offset ? [] : workouts
  const end = now - offset * days * 86400000
  const start = end - days * 86400000
  return workouts.filter((w) => {
    const t = new Date(w.started_at).getTime()
    return t >= start && t < end
  })
}

export function summary(workouts: Workout[]) {
  return {
    count: workouts.length,
    duration: workouts.reduce((a, w) => a + w.duration_s, 0),
    volume: workouts.reduce((a, w) => a + w.volume_kg, 0),
    sets: workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter((s) => s.type !== 'warmup').length, 0), 0),
  }
}

/** Series efectivas por músculo: la principal cuenta 1 y cada secundario 0,5 */
export function setsByMuscle(workouts: Workout[], find: (id: string) => Exercise | undefined) {
  const out: Partial<Record<Muscle, number>> = {}
  for (const w of workouts) {
    for (const e of w.exercises) {
      const ex = find(e.exerciseId)
      if (!ex) continue
      const n = e.sets.filter((s) => s.type !== 'warmup').length
      out[ex.muscle] = (out[ex.muscle] ?? 0) + n
      for (const m of ex.secondary) out[m] = (out[m] ?? 0) + n * 0.5
    }
  }
  return out
}

export function topExercises(workouts: Workout[]) {
  const map = new Map<string, { sets: number; sessions: number }>()
  for (const w of workouts) {
    const seen = new Set<string>()
    for (const e of w.exercises) {
      const cur = map.get(e.exerciseId) ?? { sets: 0, sessions: 0 }
      cur.sets += e.sets.filter((s) => s.type !== 'warmup').length
      if (!seen.has(e.exerciseId)) cur.sessions++
      seen.add(e.exerciseId)
      map.set(e.exerciseId, cur)
    }
  }
  return [...map.entries()].sort((a, b) => b[1].sets - a[1].sets)
}

/* ---------- calendario ---------- */

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function mondayOf(d: Date) {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

/** Semanas seguidas (hasta esta) con al menos un entreno. Si esta semana aún no hay, cuenta desde la anterior. */
export function weekStreak(workouts: Workout[], now = new Date()) {
  const weeks = new Set(workouts.map((w) => mondayOf(new Date(w.started_at)).getTime()))
  const cur = mondayOf(now)
  if (!weeks.has(cur.getTime())) cur.setDate(cur.getDate() - 7)
  let n = 0
  while (weeks.has(cur.getTime())) {
    n++
    cur.setDate(cur.getDate() - 7)
  }
  return n
}
