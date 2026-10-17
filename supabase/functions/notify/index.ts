// Heavy · notify
// Envía notificaciones push al otro cuando alguien empieza a entrenar, termina un entreno,
// da me gusta o comenta. La app la llama tras cada acción; aquí se comprueba que la acción
// existe de verdad y es de quien llama, y se avisa a los demás según sus preferencias.
//
// Desplegar en Supabase → Edge Functions → Deploy a new function → Via Editor → nombre "notify".
// Secretos necesarios (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (navegador) y FCM_SERVICE_ACCOUNT (app de Android: el JSON de la cuenta de servicio de Firebase).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
// Cada respuesta queda en Supabase → notify → Logs para poder ver qué ha pasado
const json = (data: unknown, status = 200) => {
  console.log(JSON.stringify({ status, ...(data as object) }))
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

type Kind = 'live' | 'workout' | 'like' | 'comment' | 'test'
type Message = { title: string; body: string; url: string; tag: string }

const PREF: Record<Kind, string> = { live: 'live', workout: 'workouts', like: 'likes', comment: 'comments', test: 'test' }
const first = (name?: string | null) => (name || 'Tu hermano').split(' ')[0]
const KIND_TEXT: Record<string, string> = { run: 'una carrera', hike: 'una ruta de senderismo', walk: 'una caminata', ride: 'una salida en bici' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    // Claves VAPID (secretos de la función)
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:heavy@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    )
    // Clave de administrador: se prueban la nueva (sb_secret_…) y la antigua (service_role) y se usa la que funcione
    const url = Deno.env.get('SUPABASE_URL')!
    const candidates: [string, string][] = []
    try {
      const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
      for (const [k, v] of Object.entries(keys)) candidates.push([`secret:${k}`, v])
    } catch {
      /* sin claves nuevas */
    }
    if (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) candidates.push(['service_role', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!])
    if (Deno.env.get('HEAVY_SECRET_KEY')) candidates.push(['HEAVY_SECRET_KEY', Deno.env.get('HEAVY_SECRET_KEY')!])
    let admin: ReturnType<typeof createClient> | null = null
    const tried: string[] = []
    for (const [label, key] of candidates) {
      const client = createClient(url, key, { auth: { persistSession: false } })
      const { error, status } = await client.from('push_subscriptions').select('endpoint').limit(1)
      tried.push(`${label}: ${status} ${error?.message ?? 'ok'}`)
      if (!error) {
        admin = client
        break
      }
    }
    if (!admin) return json({ error: 'Ninguna clave de administrador funciona', claves: tried }, 500)
    // Quién llama (sesión de la app)
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: auth } = await admin.auth.getUser(token)
    const caller = auth.user?.id
    if (!caller) return json({ error: 'Sin sesión' }, 401)

    const { type, id } = (await req.json()) as { type: Kind; id: string }
    console.log(JSON.stringify({ llamada: type, id, caller }))
    const { data: me } = await admin.from('profiles').select('full_name').eq('id', caller).single()
    const name = first(me?.full_name)

    let message: Message | null = null
    let recipients: string[] = []
    const others = async () => ((await admin.from('profiles').select('id').neq('id', caller)).data ?? []).map((p) => p.id as string)

    // Prueba desde Ajustes → Notificaciones: se avisa a uno mismo
    if (type === 'test') {
      recipients = [caller]
      message = { title: 'Heavy', body: 'Las notificaciones funcionan ✅', url: '#/', tag: 'test' }
    }

    if (type === 'live') {
      const { data: live } = await admin.from('live_sessions').select('title').eq('user_id', caller).maybeSingle()
      if (!live) return json({ sent: 0, reason: 'no hay entreno en directo' })
      recipients = await others()
      message = {
        title: `${name} está entrenando`,
        body: `${live.title || 'Entreno'} · toca para verlo en directo`,
        url: `#/en-directo/${caller}`,
        tag: `live-${caller}`,
      }
    }

    if (type === 'workout') {
      const { data: w } = await admin
        .from('workouts')
        .select('id, user_id, title, kind, distance_m, visibility, sets_count')
        .eq('id', id)
        .maybeSingle()
      if (!w || w.user_id !== caller || w.visibility !== 'everyone') return json({ sent: 0, reason: 'entreno no encontrado, ajeno o privado' })
      recipients = await others()
      const activity = w.kind && w.kind !== 'gym'
      message = activity
        ? {
            title: `${name} ha subido ${KIND_TEXT[w.kind] ?? 'una actividad'}`,
            body: `${w.title} · ${((w.distance_m ?? 0) / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`,
            url: `#/entreno/${w.id}`,
            tag: `workout-${w.id}`,
          }
        : { title: `${name} ha terminado un entreno`, body: `${w.title} · ${w.sets_count} series`, url: `#/entreno/${w.id}`, tag: `workout-${w.id}` }
    }

    if (type === 'like') {
      const { data: like } = await admin.from('workout_likes').select('workout_id').eq('workout_id', id).eq('user_id', caller).maybeSingle()
      const { data: w } = await admin.from('workouts').select('id, user_id, title').eq('id', id).maybeSingle()
      if (!like || !w) return json({ sent: 0, reason: 'no se encuentra el me gusta o el entreno' })
      if (w.user_id === caller) return json({ sent: 0, reason: 'el entreno es tuyo' })
      recipients = [w.user_id]
      message = { title: `A ${name} le gusta tu entreno`, body: w.title, url: `#/entreno/${w.id}`, tag: `like-${w.id}-${caller}` }
    }

    if (type === 'comment') {
      const { data: c, error: ce } = await admin.from('workout_comments').select('id, workout_id, user_id, body').eq('id', id).maybeSingle()
      if (!c) return json({ sent: 0, reason: `no se encuentra el comentario ${ce?.message ?? ''}`.trim() })
      if (c.user_id !== caller) return json({ sent: 0, reason: 'el comentario no es tuyo' })
      const { data: w } = await admin.from('workouts').select('id, user_id, title').eq('id', c.workout_id).maybeSingle()
      if (!w) return json({ sent: 0, reason: 'no se encuentra el entreno' })
      // Al dueño del entreno y a quien haya comentado antes (menos a quien comenta)
      const { data: prev } = await admin.from('workout_comments').select('user_id').eq('workout_id', w.id)
      recipients = [...new Set([w.user_id, ...(prev ?? []).map((p) => p.user_id as string)])].filter((u) => u !== caller)
      const yours = (u: string) => u === w.user_id
      message = {
        title: `${name} ha comentado`,
        body: `«${c.body.slice(0, 120)}»`,
        url: `#/entreno/${w.id}`,
        tag: `comment-${w.id}`,
      }
      // Texto distinto si el entreno no es tuyo (solo cambia el título)
      if (!recipients.some(yours)) message.title = `${name} ha respondido en «${w.title}»`
    }

    if (!message || !recipients.length) return json({ sent: 0, reason: 'nada que avisar' })

    // Preferencias de cada uno
    const { data: prefs } = await admin.from('profiles').select('id, notify').in('id', recipients)
    const wanted = (prefs ?? []).filter((p) => (p.notify ?? {})[PREF[type]] !== false).map((p) => p.id as string)
    if (!wanted.length) return json({ sent: 0, reason: 'el otro tiene este aviso desactivado' })

    const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', wanted)
    if (!subs?.length) return json({ sent: 0, reason: 'el destinatario no ha activado las notificaciones en ningún móvil' })
    let sent = 0
    const errors: string[] = []
    const fcm = subs.filter((s) => s.endpoint.startsWith('fcm:'))
    const web = subs.filter((s) => !s.endpoint.startsWith('fcm:'))
    // Navegador (Web Push)
    await Promise.all(
      web.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 3600 })
          sent++
        } catch (e) {
          // Suscripción caducada (app desinstalada, permiso quitado…): se borra
          const status = (e as { statusCode?: number }).statusCode
          errors.push(`${status ?? ''} ${(e as { body?: string; message?: string }).body ?? (e as Error).message}`.trim())
          if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }),
    )
    // App de Android (Firebase Cloud Messaging)
    if (fcm.length) {
      const access = await fcmAccess()
      if (!access) errors.push('Falta el secreto FCM_SERVICE_ACCOUNT para avisar a la app de Android')
      else
        await Promise.all(
          fcm.map(async (s) => {
            const r = await fcmSend(access, s.endpoint.slice(4), message!)
            if (r.ok) sent++
            else {
              errors.push(`fcm ${r.status} ${r.error}`)
              if (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(r.error)) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
            }
          }),
        )
    }
    return json({ sent, errors })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

/* ---------- Firebase Cloud Messaging (app de Android) ---------- */

type ServiceAccount = { client_email: string; private_key: string; project_id: string }

const b64url = (data: ArrayBuffer | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

/** Token de acceso de Google a partir de la cuenta de servicio (JWT firmado con su clave) */
async function fcmAccess(): Promise<{ token: string; project: string } | null> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!raw) return null
  const sa = JSON.parse(raw) as ServiceAccount
  const now = Math.floor(Date.now() / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claims}`))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64url(sig)}` }),
  })
  const data = (await res.json()) as { access_token?: string }
  return data.access_token ? { token: data.access_token, project: sa.project_id } : null
}

async function fcmSend(access: { token: string; project: string }, token: string, m: Message) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${access.project}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: m.title, body: m.body },
        data: { url: m.url, title: m.title, body: m.body },
        android: {
          priority: 'high',
          notification: { channel_id: 'social', icon: 'ic_stat_heavy', color: '#1c8cff', tag: m.tag },
        },
      },
    }),
  })
  if (res.ok) return { ok: true, status: 200, error: '' }
  const text = await res.text()
  return { ok: false, status: res.status, error: text.slice(0, 200) }
}
