/* Notificación del entreno en curso (como la de Hevy):
   descanso con −15 s / +15 s / Saltar, y "Completar serie" cuando no hay descanso. */

import type { Exercise } from '../lib/exercises'
import { effective, fmtClock, fmtKg, type ActiveWorkout, type WorkoutSet } from '../lib/workouts'
import { isNative, nativeCloseWorkout, nativeNotificationPermission, nativeWorkoutNotification } from '../native'

const TAG = 'heavy-workout'

export const notificationsSupported = () => !isNative && 'Notification' in window && 'serviceWorker' in navigator

/** Se pide permiso al empezar un entreno (tiene que ser tras un toque del usuario) */
export async function askNotificationPermission() {
  if (isNative) {
    await nativeNotificationPermission()
    return
  }
  if (!notificationsSupported() || Notification.permission !== 'default') return
  try {
    await Notification.requestPermission()
  } catch {
    /* sin permiso */
  }
}

async function registration() {
  if (!notificationsSupported() || Notification.permission !== 'granted') return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

/** Siguiente serie pendiente: [índice ejercicio, índice serie] */
export function nextPending(a: ActiveWorkout): [number, number] | null {
  const pending = (ei: number) => a.exercises[ei].sets.findIndex((s) => !s.done)
  for (let ei = 0; ei < a.exercises.length; ei++) {
    const si = pending(ei)
    if (si < 0) continue
    // En una superserie toca el ejercicio del grupo que va más atrasado (se alternan)
    const id = a.exercises[ei].supersetId
    if (id) {
      let best = ei
      let bestDone = a.exercises[ei].sets.filter((s) => s.done).length
      a.exercises.forEach((e, i) => {
        if (i === ei || e.supersetId !== id || pending(i) < 0) return
        const d = e.sets.filter((s) => s.done).length
        if (d < bestDone) [best, bestDone] = [i, d]
      })
      return [best, pending(best)]
    }
    return [ei, si]
  }
  return null
}

/** Series de la última vez que se hizo cada ejercicio */
export type PrevOf = (exerciseId: string) => WorkoutSet[]

/** Texto "Siguiente: …": lo escrito en la serie, si no lo de la vez anterior y si no lo de la rutina */
function nextLineOf(a: ActiveWorkout, find: (id: string) => Exercise | undefined, prevOf?: PrevOf) {
  const next = nextPending(a)
  if (!next) return 'Todas las series completadas'
  const ex = a.exercises[next[0]]
  const set = ex.sets[next[1]]
  const info = find(ex.exerciseId)
  const v = effective(set, prevOf?.(ex.exerciseId)[next[1]])
  const type = info?.type ?? 'weight_reps'
  const values =
    type === 'duration'
      ? v.duration != null
        ? ` · ${fmtClock(v.duration)}`
        : ''
      : v.reps != null || v.weight != null
        ? ` · ${v.weight != null && type !== 'reps' ? `${type === 'assisted' ? '-' : ''}${fmtKg(v.weight)} kg × ` : ''}${v.reps ?? '-'}`
        : ''
  return `Siguiente: ${info?.name ?? 'Ejercicio'} · serie ${next[1] + 1}${values}`
}

/* App de Android: notificación nativa (cuenta atrás y aviso de descanso los gestiona Android) */
async function showNative(a: ActiveWorkout, find: (id: string) => Exercise | undefined, prevOf?: PrevOf) {
  const resting = !!a.rest && a.rest.endsAt > Date.now()
  await nativeWorkoutNotification(a.title, nextLineOf(a, find, prevOf), resting ? a.rest!.endsAt : null, !!nextPending(a))
}

export async function showWorkoutNotification(a: ActiveWorkout, find: (id: string) => Exercise | undefined, restDone = false, prevOf?: PrevOf) {
  if (isNative) return showNative(a, find, prevOf).catch(() => {})
  const reg = await registration()
  if (!reg) return
  // Si el aviso del servidor ya avisó del fin del descanso, no se vuelve a sonar
  if (restDone) {
    const shown = await reg.getNotifications({ tag: TAG })
    if (shown.some((n) => n.title === '¡Descanso terminado!')) restDone = false
  }
  const next = nextPending(a)
  const nextLine = nextLineOf(a, find, prevOf)

  const resting = a.rest && a.rest.endsAt > Date.now()
  // Cuenta atrás: se vuelve a pintar cada segundo mientras dura el descanso
  const left = resting ? Math.ceil((a.rest!.endsAt - Date.now()) / 1000) : 0
  const title = restDone ? '¡Descanso terminado!' : resting ? `Descanso ${fmtClock(left)}` : a.title
  const actions = resting
    ? [
        // Android muestra como máximo 2 botones; "Saltar" está dentro de la app
        { action: 'rest-minus', title: '−15 s' },
        { action: 'rest-plus', title: '+15 s' },
      ]
    : next
      ? [{ action: 'complete', title: '✓ Completar serie' }]
      : []

  // Algunas opciones (acciones, vibración…) aún no están en los tipos de TypeScript
  const options: Record<string, unknown> = {
    tag: TAG,
    body: nextLine,
    icon: `${import.meta.env.BASE_URL}pwa-192.png`,
    badge: `${import.meta.env.BASE_URL}pwa-192.png`,
    // Solo suena y vibra al terminar el descanso; las actualizaciones son silenciosas
    silent: !restDone,
    renotify: restDone,
    requireInteraction: true,
    vibrate: restDone ? [250, 120, 250] : undefined,
    actions,
    timestamp: resting ? a.rest!.endsAt : a.startedAt,
  }
  await reg.showNotification(title, options as NotificationOptions)
}

export async function closeWorkoutNotification() {
  if (isNative) {
    return nativeCloseWorkout()
  }
  const reg = await registration()
  if (!reg) return
  const list = await reg.getNotifications({ tag: TAG })
  list.forEach((n) => n.close())
}
