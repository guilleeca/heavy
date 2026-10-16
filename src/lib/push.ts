/* Notificaciones push: activar en este móvil y avisar al otro tras cada acción. */

import { supabase } from './supabase'

// Clave pública VAPID (la privada está solo en los secretos de Supabase)
const VAPID_PUBLIC_KEY = 'BLtxzB6_N_BV-V_7KEhs-_KxBEfULxehfGVH3SFYWM-mRP141L4qplOj8qGyRymO1I9OvYpzjOdZg0Y6t9h60B4'

export type PushKind = 'live' | 'workout' | 'like' | 'comment'
export type NotifyPrefs = { live: boolean; workouts: boolean; likes: boolean; comments: boolean }
export const DEFAULT_PREFS: NotifyPrefs = { live: true, workouts: true, likes: true, comments: true }

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** ¿Este móvil ya recibe notificaciones? */
export async function pushEnabledHere() {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  return !!(await reg.pushManager.getSubscription())
}

/** Activa las notificaciones en este móvil (pide permiso si hace falta) */
export async function enablePush(): Promise<string | null> {
  if (!pushSupported()) return 'Este navegador no admite notificaciones'
  if (Notification.permission === 'denied') return 'Las notificaciones están bloqueadas: actívalas en los ajustes de Heavy en Android'
  if ((await Notification.requestPermission()) !== 'granted') return 'Sin permiso no se pueden enviar avisos'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }))
    const json = sub.toJSON()
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' }, { onConflict: 'endpoint' })
    return error ? 'No se pudo guardar (¿falta ejecutar 010_notificaciones.sql?)' : null
  } catch {
    return 'No se pudieron activar las notificaciones'
  }
}

export async function disablePush() {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Avisa a los demás de algo que acabo de hacer (no bloquea; si falla, no pasa nada) */
export function sendPush(type: PushKind, id: string) {
  void supabase.functions.invoke('notify', { body: { type, id } }).catch(() => {})
}
