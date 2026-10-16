// Heavy · notify
// Envía notificaciones push al otro cuando alguien empieza a entrenar, termina un entreno,
// da me gusta o comenta. La app la llama tras cada acción; aquí se comprueba que la acción
// existe de verdad y es de quien llama, y se avisa a los demás según sus preferencias.
//
// Desplegar en Supabase → Edge Functions → Deploy a new function → Via Editor → nombre "notify".
// Secretos necesarios (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Kind = 'live' | 'workout' | 'like' | 'comment'
type Message = { title: string; body: string; url: string; tag: string }

const PREF: Record<Kind, string> = { live: 'live', workout: 'workouts', like: 'likes', comment: 'comments' }
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
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    // Quién llama (sesión de la app)
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: auth } = await admin.auth.getUser(token)
    const caller = auth.user?.id
    if (!caller) return json({ error: 'Sin sesión' }, 401)

    const { type, id } = (await req.json()) as { type: Kind; id: string }
    const { data: me } = await admin.from('profiles').select('full_name').eq('id', caller).single()
    const name = first(me?.full_name)

    let message: Message | null = null
    let recipients: string[] = []
    const others = async () => ((await admin.from('profiles').select('id').neq('id', caller)).data ?? []).map((p) => p.id as string)

    if (type === 'live') {
      const { data: live } = await admin.from('live_sessions').select('title').eq('user_id', caller).maybeSingle()
      if (!live) return json({ sent: 0 })
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
      if (!w || w.user_id !== caller || w.visibility !== 'everyone') return json({ sent: 0 })
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
      if (!like || !w || w.user_id === caller) return json({ sent: 0 })
      recipients = [w.user_id]
      message = { title: `A ${name} le gusta tu entreno`, body: w.title, url: `#/entreno/${w.id}`, tag: `like-${w.id}-${caller}` }
    }

    if (type === 'comment') {
      const { data: c } = await admin.from('workout_comments').select('id, workout_id, user_id, body').eq('id', id).maybeSingle()
      if (!c || c.user_id !== caller) return json({ sent: 0 })
      const { data: w } = await admin.from('workouts').select('id, user_id, title').eq('id', c.workout_id).maybeSingle()
      if (!w) return json({ sent: 0 })
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

    if (!message || !recipients.length) return json({ sent: 0 })

    // Preferencias de cada uno
    const { data: prefs } = await admin.from('profiles').select('id, notify').in('id', recipients)
    const wanted = (prefs ?? []).filter((p) => (p.notify ?? {})[PREF[type]] !== false).map((p) => p.id as string)
    if (!wanted.length) return json({ sent: 0 })

    const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', wanted)
    let sent = 0
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 3600 })
          sent++
        } catch (e) {
          // Suscripción caducada (app desinstalada, permiso quitado…): se borra
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }),
    )
    return json({ sent })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
