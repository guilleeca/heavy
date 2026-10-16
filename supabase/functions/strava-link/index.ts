// Heavy · strava-link
// Convierte un enlace corto de Strava (strava.app.link/…) en el número de la actividad,
// para poder descargar su GPX. Solo sigue enlaces de Strava (no es un proxy abierto).
// Desplegar en Supabase → Edge Functions → Deploy a new function → Via Editor → nombre "strava-link".

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const ALLOWED = /^https:\/\/(strava\.app\.link|www\.strava\.com|strava\.com)\//i
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const activityId = (s: string) => s.match(/strava\.com\/activities\/(\d+)/)?.[1] ?? null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { url } = await req.json()
    if (typeof url !== 'string' || !ALLOWED.test(url)) return json({ error: 'Enlace no válido' }, 400)
    let current = url
    for (let i = 0; i < 5; i++) {
      const id = activityId(current)
      if (id) return json({ id })
      const res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14)' } })
      const next = res.headers.get('location')
      if (!next) {
        const found = activityId(await res.text())
        return found ? json({ id: found }) : json({ error: 'No se encontró la actividad' }, 404)
      }
      current = new URL(next, current).href
      if (!ALLOWED.test(current) && !activityId(current)) break
    }
    return json({ error: 'No se encontró la actividad' }, 404)
  } catch {
    return json({ error: 'No se pudo leer el enlace' }, 500)
  }
})
