/* Estadísticas de carreras y rutas: totales, reparto por tipo y récords (mejores marcas). */

import { trackDistances, type ActivityKind } from './gpx'
import { isActivity, type Workout } from './workouts'

export const activities = (workouts: Workout[]) => workouts.filter(isActivity)
export const gymOnly = (workouts: Workout[]) => workouts.filter((w) => !isActivity(w))

/** Tiempo de una actividad: en movimiento si lo hay; si no, el total */
export const activeSeconds = (w: Workout) => w.moving_s || w.duration_s || 0

export function activitySummary(list: Workout[]) {
  return {
    count: list.length,
    distance: list.reduce((a, w) => a + (w.distance_m ?? 0), 0),
    elevation: list.reduce((a, w) => a + (w.elevation_gain_m ?? 0), 0),
    time: list.reduce((a, w) => a + activeSeconds(w), 0),
  }
}

/** Kilómetros por tipo de actividad, de más a menos */
export function distanceByKind(list: Workout[]) {
  const out = new Map<ActivityKind, { distance: number; count: number }>()
  for (const w of list) {
    const k = w.kind as ActivityKind
    const cur = out.get(k) ?? { distance: 0, count: 0 }
    cur.distance += w.distance_m ?? 0
    cur.count++
    out.set(k, cur)
  }
  return [...out.entries()].sort((a, b) => b[1].distance - a[1].distance)
}

export type Record = { value: number; workoutId: string; date: Date; title: string }

const better = (cur: Record | null, value: number, w: Workout, lower = false): Record | null =>
  value > 0 && (!cur || (lower ? value < cur.value : value > cur.value))
    ? { value, workoutId: w.id, date: new Date(w.started_at), title: w.title }
    : cur

/** Distancias de las mejores marcas, como Strava */
export const EFFORTS: { meters: number; label: string }[] = [
  { meters: 1000, label: '1 km' },
  { meters: 5000, label: '5 km' },
  { meters: 10000, label: '10 km' },
  { meters: 21097.5, label: 'Media maratón' },
  { meters: 42195, label: 'Maratón' },
]

/** Tiempo más rápido en que se cubrió cada distancia dentro del recorrido (ventana deslizante) */
export function fastestEfforts(track: Workout['track']): (number | null)[] {
  if (!track || track.length < 2 || track.some((p) => p[3] == null)) return EFFORTS.map(() => null)
  const cum = trackDistances(track)
  const t = track.map((p) => p[3] as number)
  return EFFORTS.map(({ meters }) => {
    if (cum[cum.length - 1] < meters) return null
    let best: number | null = null
    let i = 0
    for (let j = 1; j < track.length; j++) {
      // Avanza el inicio mientras siga quedando la distancia completa
      while (cum[j] - cum[i + 1] >= meters) i++
      const d = cum[j] - cum[i]
      if (d < meters) continue
      // Se recorta el exceso del primer tramo suponiendo velocidad constante en él
      const seg = cum[i + 1] - cum[i]
      const extra = d - meters
      const t0 = seg > 0 ? t[i] + ((t[i + 1] - t[i]) * Math.min(extra, seg)) / seg : t[i]
      const s = t[j] - t0
      if (s > 0 && (best == null || s < best)) best = s
    }
    return best
  })
}

/** Récords de un tipo de actividad */
export function activityRecords(list: Workout[], kind: ActivityKind) {
  const of = list.filter((w) => w.kind === kind)
  let longest: Record | null = null
  let climb: Record | null = null
  let duration: Record | null = null
  let pace: Record | null = null
  const efforts: (Record | null)[] = EFFORTS.map(() => null)
  for (const w of of) {
    const dist = w.distance_m ?? 0
    longest = better(longest, dist, w)
    climb = better(climb, w.elevation_gain_m ?? 0, w)
    duration = better(duration, activeSeconds(w), w)
    // Ritmo medio (segundos por km) solo en salidas de al menos 1 km
    if (dist >= 1000 && activeSeconds(w)) pace = better(pace, activeSeconds(w) / (dist / 1000), w, true)
    if (kind === 'run' || kind === 'walk') fastestEfforts(w.track).forEach((s, i) => s != null && (efforts[i] = better(efforts[i], s, w, true)))
  }
  return { count: of.length, longest, climb, duration, pace, efforts }
}

/** Tiempo de carrera: "23:45" o "1:42:10" */
export function fmtRaceTime(s: number) {
  const r = Math.round(s)
  const h = Math.floor(r / 3600)
  const m = Math.floor((r % 3600) / 60)
  const sec = String(r % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export const fmtKmShort = (m: number) => `${(m / 1000).toLocaleString('es-ES', { maximumFractionDigits: m >= 100000 ? 0 : 1 })} km`
export const fmtMeters = (m: number) => `${Math.round(m).toLocaleString('es-ES')} m`
