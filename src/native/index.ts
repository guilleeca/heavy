/* Heavy dentro de la app de Android (Capacitor).
   La misma web funciona en el navegador y dentro del APK; aquí está todo lo que
   solo existe en la app nativa: inicio de sesión con Google en el navegador del
   sistema, botón Atrás, "Compartir con Heavy", notificaciones nativas
   (descanso, entreno en curso, avisos del hermano) y GPS con la pantalla apagada. */

import { Capacitor, registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Filesystem } from '@capacitor/filesystem'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { KeepAwake } from '@capacitor-community/keep-awake'
import { CapacitorShareTarget } from '@capgo/capacitor-share-target'
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'
import { supabase } from '../lib/supabase'
import { storeShared } from '../lib/shared'

export const isNative = Capacitor.isNativePlatform()

/** Dirección a la que vuelve Google tras iniciar sesión en la app */
export const NATIVE_LOGIN_URL = 'es.heavy.app://login'

const go = (hash: string) => {
  window.location.hash = hash.replace(/^#/, '')
}

/* ---------- arranque ---------- */

let started = false
export function initNative() {
  if (!isNative || started) return
  started = true

  // Botón Atrás de Android: vuelve atrás en la app; en la primera pantalla, la minimiza
  void App.addListener('backButton', ({ canGoBack }) => {
    const home = ['', '#', '#/'].includes(window.location.hash)
    if (canGoBack && !home) window.history.back()
    else void App.minimizeApp()
  })

  // Vuelta del login de Google (es.heavy.app://login?code=…)
  void App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_LOGIN_URL)) return
    void Browser.close().catch(() => {})
    const u = new URL(url.replace(NATIVE_LOGIN_URL, 'https://x/login'))
    const q = new URLSearchParams(u.search + '&' + u.hash.replace(/^#/, ''))
    const code = q.get('code')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) sessionStorage.setItem('heavy.loginError', error.message)
    } else if (q.get('error_description')) {
      sessionStorage.setItem('heavy.loginError', q.get('error_description')!)
    }
    window.location.reload()
  })

  // Canales de notificación (Android los usa para el sonido y la importancia)
  void (async () => {
    await LocalNotifications.createChannel({ id: 'workout', name: 'Entreno en curso', importance: 2, vibration: false, visibility: 1 })
    await LocalNotifications.createChannel({ id: 'rest', name: 'Fin del descanso', importance: 5, vibration: true, visibility: 1 })
    await LocalNotifications.createChannel({
      id: 'social',
      name: 'Tu hermano',
      description: 'Entrenos, me gusta y comentarios',
      importance: 4,
      visibility: 1,
    })
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'rest',
          actions: [
            { id: 'rest-minus', title: '−15 s' },
            { id: 'rest-plus', title: '+15 s' },
          ],
        },
        { id: 'complete', actions: [{ id: 'complete', title: '✓ Completar serie' }] },
      ],
    })
  })().catch(() => {})

  // Botones y toques de las notificaciones locales
  void LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
    const url = (notification.extra as { url?: string } | undefined)?.url
    if (actionId === 'tap') {
      if (url) go(url)
      return
    }
    window.dispatchEvent(new CustomEvent('heavy-action', { detail: actionId }))
  })

  // Notificaciones push (Firebase): al tocarlas se abre la pantalla que toca
  void PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const url = (notification.data as { url?: string } | undefined)?.url
    if (url) go(url)
  })
  // Con la app abierta Android no las enseña solas: se muestran como locales
  void PushNotifications.addListener('pushNotificationReceived', (n) => {
    const data = (n.data ?? {}) as { url?: string; title?: string; body?: string }
    void LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1e9),
          title: n.title ?? data.title ?? 'Heavy',
          body: n.body ?? data.body ?? '',
          channelId: 'social',
          smallIcon: 'ic_stat_heavy',
          extra: { url: data.url },
        },
      ],
    })
  })

  // El token de Firebase puede cambiar: se actualiza al abrir la app con sesión
  let refreshed = false
  supabase.auth.onAuthStateChange((_e, session) => {
    if (!session || refreshed) return
    refreshed = true
    setTimeout(() => void nativeRefreshPushToken(), 2000)
  })

  // "Compartir con Heavy" desde otras apps
  void CapacitorShareTarget.addListener('shareReceived', async (ev) => {
    const files: File[] = []
    for (const f of ev.files ?? []) {
      try {
        const path = f.uri.startsWith('file:') || f.uri.startsWith('content:') ? f.uri : `file://${f.uri}`
        const { data } = await Filesystem.readFile({ path })
        const blob = typeof data === 'string' ? await (await fetch(`data:${f.mimeType || 'application/octet-stream'};base64,${data}`)).blob() : data
        files.push(new File([blob], f.name || 'archivo', { type: f.mimeType || '' }))
      } catch {
        /* archivo ilegible */
      }
    }
    const text = [ev.title, ...(ev.texts ?? [])].filter(Boolean).join(' ').slice(0, 1000)
    go(await storeShared(files, text))
  })
}

/* ---------- inicio de sesión ---------- */

/** Abre Google en el navegador del sistema (Google no deja iniciar sesión dentro de la app) */
export async function nativeGoogleLogin() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_LOGIN_URL, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  })
  if (error || !data.url) return error ?? new Error('Sin enlace de Google')
  await Browser.open({ url: data.url, windowName: '_self' })
  return null
}

/* ---------- pantalla encendida ---------- */

export async function nativeKeepAwake(): Promise<() => void> {
  try {
    await KeepAwake.keepAwake()
  } catch {
    /* sin permiso */
  }
  return () => void KeepAwake.allowSleep().catch(() => {})
}

/* ---------- notificaciones locales ---------- */

export async function nativeNotificationPermission() {
  try {
    const p = await LocalNotifications.checkPermissions()
    if (p.display === 'granted') return true
    return (await LocalNotifications.requestPermissions()).display === 'granted'
  } catch {
    return false
  }
}

export const WORKOUT_ID = 1
export const REST_ID = 2
const ALERT_ID = 3

/** Notificación fija del entreno en curso */
export async function nativeWorkoutNotification(title: string, body: string, resting: boolean, hasNext: boolean) {
  await LocalNotifications.schedule({
    notifications: [
      {
        id: WORKOUT_ID,
        title,
        body,
        channelId: 'workout',
        ongoing: true,
        autoCancel: false,
        smallIcon: 'ic_stat_heavy',
        actionTypeId: resting ? 'rest' : hasNext ? 'complete' : undefined,
        extra: { url: '#/entreno' },
      },
    ],
  })
}

/** Programa (o mueve) el aviso de fin de descanso a su hora exacta; null lo cancela */
let restAt: number | null = null
export async function nativeRestAlarm(endsAt: number | null, body: string) {
  if (endsAt === restAt) return
  const prev = restAt
  restAt = endsAt
  // Si el descanso anterior ya terminó, su aviso está a la vista: no se quita
  if (prev != null && prev > Date.now() + 500) await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] }).catch(() => {})
  if (endsAt == null || endsAt <= Date.now()) return
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REST_ID,
        title: '¡Descanso terminado!',
        body,
        channelId: 'rest',
        smallIcon: 'ic_stat_heavy',
        actionTypeId: 'complete',
        schedule: { at: new Date(endsAt), allowWhileIdle: true },
        extra: { url: '#/entreno' },
      },
    ],
  })
}

export async function nativeCloseWorkout() {
  restAt = null
  await LocalNotifications.cancel({ notifications: [{ id: WORKOUT_ID }, { id: REST_ID }] }).catch(() => {})
}

/** Aviso inmediato con sonido y vibración (p. ej. "te has salido de la ruta") */
export async function nativeAlert(title: string, body: string) {
  await LocalNotifications.schedule({
    notifications: [{ id: ALERT_ID, title, body, channelId: 'rest', smallIcon: 'ic_stat_heavy' }],
  }).catch(() => {})
}

/* ---------- notificaciones push (Firebase) ---------- */

const TOKEN_KEY = 'heavy.fcmToken'
const storedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function nativePushEnabled() {
  try {
    return (await PushNotifications.checkPermissions()).receive === 'granted' && !!storedToken()
  } catch {
    return false
  }
}

/** Activa los avisos push en este móvil y guarda su token en Supabase */
export async function nativeEnablePush(): Promise<string | null> {
  try {
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive !== 'granted') perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return 'Sin permiso no se pueden enviar avisos'
    await PushNotifications.createChannel({ id: 'social', name: 'Tu hermano', importance: 4, visibility: 1 }).catch(() => {})
    const handles: { remove: () => Promise<void> }[] = []
    const token = await new Promise<string>((resolve, reject) => {
      void PushNotifications.addListener('registration', (t) => resolve(t.value)).then((h) => handles.push(h))
      void PushNotifications.addListener('registrationError', (e) => reject(new Error(e.error))).then((h) => handles.push(h))
      void PushNotifications.register()
      setTimeout(() => reject(new Error('Sin respuesta de Firebase')), 15000)
    }).finally(() => handles.forEach((h) => void h.remove()))
    const old = storedToken()
    if (old && old !== token) await supabase.from('push_subscriptions').delete().eq('endpoint', `fcm:${old}`)
    const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: `fcm:${token}`, p256dh: '', auth: '' }, { onConflict: 'endpoint' })
    if (error) return 'No se pudo guardar el aviso en Supabase'
    localStorage.setItem(TOKEN_KEY, token)
    return null
  } catch (e) {
    return `No se pudieron activar los avisos (${(e as Error).message})`
  }
}

export async function nativeDisablePush() {
  const token = storedToken()
  if (token) await supabase.from('push_subscriptions').delete().eq('endpoint', `fcm:${token}`)
  localStorage.removeItem(TOKEN_KEY)
  await PushNotifications.unregister().catch(() => {})
}

/** Al abrir la app, si el token de Firebase cambió, se actualiza en Supabase */
export async function nativeRefreshPushToken() {
  if (!storedToken()) return
  await nativeEnablePush()
}

/* ---------- GPS con la pantalla apagada (seguir ruta) ---------- */

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

export type Fix = { lat: number; lon: number; acc: number; heading: number | null }

/** Sigue la posición; en la app nativa sigue funcionando con la pantalla apagada */
export function watchPosition(onFix: (f: Fix) => void, onError: (msg: string) => void): () => void {
  if (isNative) {
    let id: string | null = null
    let stopped = false
    void BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: 'Heavy · siguiendo la ruta',
        backgroundMessage: 'Te aviso si te sales del camino',
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
      },
      (loc, err) => {
        if (err) {
          onError(err.code === 'NOT_AUTHORIZED' ? 'Permite la ubicación para Heavy en los ajustes' : 'Buscando señal GPS…')
          return
        }
        if (loc) onFix({ lat: loc.latitude, lon: loc.longitude, acc: loc.accuracy, heading: loc.bearing })
      },
    ).then((w) => {
      id = w
      if (stopped) void BackgroundGeolocation.removeWatcher({ id: w })
    })
    return () => {
      stopped = true
      if (id) void BackgroundGeolocation.removeWatcher({ id })
    }
  }
  if (!('geolocation' in navigator)) {
    onError('Este móvil no tiene GPS disponible')
    return () => {}
  }
  const watch = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, heading: p.coords.heading }),
    (e) => onError(e.code === 1 ? 'Permite la ubicación para Heavy en los ajustes' : 'Buscando señal GPS…'),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
  )
  return () => navigator.geolocation.clearWatch(watch)
}
