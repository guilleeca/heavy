/* Notificación del entreno en curso (como la de Hevy):
   descanso con −15 s / +15 s / Saltar, y "Completar serie" cuando no hay descanso. */

import type { Exercise } from '../lib/exercises'
import { fmtKg, type ActiveWorkout } from '../lib/workouts'

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
  for (let ei = 0; ei < a.exercises.length; ei++) {
    const si = a.exercises[ei].sets.findIndex((s) => !s.done)
    if (si >= 0) return [ei, si]
  }
  return null
}

const time = (ms: number) => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export async function showWorkoutNotification(a: ActiveWorkout, find: (id: string) => Exercise | undefined, restDone = false) {
  const reg = await registration()
  if (!reg) return
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
  const title = restDone ? '¡Descanso terminado!' : resting ? `Descanso hasta las ${time(a.rest!.endsAt)}` : a.title
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
