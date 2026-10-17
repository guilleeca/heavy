/* Notificación del entreno en curso (como la de Hevy):
   descanso con −15 s / +15 s / Saltar, y "Completar serie" cuando no hay descanso. */

import type { Exercise } from '../lib/exercises'
import { fmtClock, fmtKg, type ActiveWorkout } from '../lib/workouts'

const TAG = 'heavy-workout'

export const notificationsSupported = () => 'Notification' in window && 'serviceWorker' in navigator

/** Se pide permiso al empezar un entreno (tiene que ser tras un toque del usuario) */
export async function askNotificationPermission() {
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

export async function showWorkoutNotification(a: ActiveWorkout, find: (id: string) => Exercise | undefined, restDone = false) {
  const reg = await registration()
  if (!reg) return
  // Si el aviso del servidor ya avisó del fin del descanso, no se vuelve a sonar
  if (restDone) {
    const shown = await reg.getNotifications({ tag: TAG })
    if (shown.some((n) => n.title === '¡Descanso terminado!')) restDone = false
  }
  const next = nextPending(a)
  const nextEx = next ? a.exercises[next[0]] : null
  const nextSet = next && nextEx ? nextEx.sets[next[1]] : null
  const nextLine =
    nextEx && nextSet
      ? `Siguiente: ${find(nextEx.exerciseId)?.name ?? 'Ejercicio'} · serie ${next![1] + 1}` +
        (nextSet.target?.weight != null || nextSet.target?.reps != null
          ? ` · ${nextSet.target?.weight != null ? `${fmtKg(nextSet.target.weight)} kg × ` : ''}${nextSet.target?.reps ?? '-'}`
          : '')
      : 'Todas las series completadas'

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
  const reg = await registration()
  if (!reg) return
  const list = await reg.getNotifications({ tag: TAG })
  list.forEach((n) => n.close())
}
