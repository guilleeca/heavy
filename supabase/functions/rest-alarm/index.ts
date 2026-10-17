// Heavy · rest-alarm
// Aviso de "¡Descanso terminado!" enviado desde el servidor. Con el móvil bloqueado,
// Android duerme la app y su propio temporizador puede llegar tarde; una notificación
// push, en cambio, llega a su hora.
//
// La app llama a esta función cada vez que empieza, cambia (±15 s) o se salta un descanso:
//   { endsAt: 1729160000000 }  → avisar a esa hora (milisegundos)
//   { endsAt: null }           → cancelar
// Solo vale el último aviso pedido (tabla rest_alarms); los anteriores se descartan solos.
//
// Desplegar en Supabase → Edge Functions → Deploy a new function → Via Editor → nombre "rest-alarm".
// Usa los mismos secretos que "notify": VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) => {
  console.log(JSON.stringify({ status, ...(data as object) }))
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Cada ejecución espera como mucho esto; si el descanso es más largo, se vuelve a llamar a sí misma
const CHUNK_MS = 110_000

function adminKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const first = keys.default ?? Object.values(keys)[0]
    if (first) return first
  } catch {
    /* sin claves nuevas */
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, adminKey(), { auth: { persistSession: false } })
    const authHeader = req.headers.get('Authorization') ?? ''
    const { data: auth } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    const caller = auth.user?.id
    if (!caller) return json({ error: 'Sin sesión' }, 401)

    const body = (await req.json()) as { endsAt: number | null; chained?: boolean }
    const endsAt = typeof body.endsAt === 'number' ? Math.round(body.endsAt) : null

    // La primera llamada guarda el aviso vigente (las encadenadas no lo tocan)
    if (!body.chained) {
      const { error } = await admin.from('rest_alarms').upsert({ user_id: caller, ends_at: endsAt, updated_at: new Date().toISOString() })
      if (error) return json({ error: `No se pudo guardar el aviso: ${error.message}` }, 500)
    }
    if (endsAt == null) return json({ ok: true, cancelled: true })
    const wait = endsAt - Date.now()
    if (wait > 15 * 60_000 || wait < -10_000) return json({ ok: false, reason: 'hora fuera de rango' })

    EdgeRuntime.waitUntil(
      (async () => {
        await sleep(Math.max(0, Math.min(wait, CHUNK_MS)))
        // ¿Sigue siendo el aviso vigente? (si se movió o se saltó el descanso, no)
        const { data: cur } = await admin.from('rest_alarms').select('ends_at').eq('user_id', caller).maybeSingle()
        if (Number(cur?.ends_at) !== endsAt) return console.log(JSON.stringify({ descartado: endsAt, vigente: cur?.ends_at ?? null }))

        // Descanso largo: se sigue esperando en una nueva ejecución
        if (endsAt - Date.now() > 1500) {
          await fetch(`${url}/functions/v1/rest-alarm`, {
            method: 'POST',
            headers: { Authorization: authHeader, apikey: req.headers.get('apikey') ?? '', 'Content-Type': 'application/json' },
            body: JSON.stringify({ endsAt, chained: true }),
          })
          return
        }

        webpush.setVapidDetails(
          Deno.env.get('VAPID_SUBJECT') ?? 'mailto:heavy@example.com',
          Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
          Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
        )
        const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', caller)
        // La app de Android programa su propio aviso: aquí solo los navegadores
        const webSubs = (subs ?? []).filter((x) => !x.endpoint.startsWith('fcm:'))
        const message = JSON.stringify({
          type: 'rest',
          title: '¡Descanso terminado!',
          body: 'A por la siguiente serie',
          tag: 'heavy-workout',
          url: '#/entreno',
          endsAt,
        })
        let sent = 0
        await Promise.all(
          webSubs.map(async (s) => {
            try {
              // Urgencia alta: Android lo entrega al momento aunque esté en reposo
              await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, {
                TTL: 60,
                urgency: 'high',
              })
              sent++
            } catch (e) {
              const status = (e as { statusCode?: number }).statusCode
              if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
            }
          }),
        )
        console.log(JSON.stringify({ aviso: endsAt, sent, retraso_ms: Date.now() - endsAt }))
      })(),
    )
    return json({ ok: true, wait })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
