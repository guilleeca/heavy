/* Rutas y carreras: leer archivos GPX/TCX (Strava, Garmin, Wikiloc, relojes…)
   y calcular distancia, desnivel, ritmo y parciales por kilómetro. */

export type ActivityKind = 'run' | 'hike' | 'walk' | 'ride'
export type Kind = 'gym' | ActivityKind

export const KIND_LABEL: Record<Kind, string> = {
  gym: 'Gimnasio',
  run: 'Carrera',
  hike: 'Senderismo',
  walk: 'Caminata',
  ride: 'Bici',
}

export const KIND_EMOJI: Record<Kind, string> = { gym: '🏋️', run: '🏃', hike: '🥾', walk: '🚶', ride: '🚴' }

/** Punto guardado: [lat, lon, altitud | null, segundos desde el inicio | null, pulso | null] */
export type TrackPoint = [number, number, number | null, number | null, number | null]

type RawPoint = { lat: number; lon: number; ele: number | null; time: number | null; hr: number | null }

export type ParsedActivity = {
  name: string
  kind: ActivityKind
  startedAt: number | null
  /** Tiempo total (de la primera a la última marca) */
  durationS: number | null
  movingS: number | null
  distanceM: number
  elevationGainM: number
  track: TrackPoint[]
}

/* ---------- geometría ---------- */

const R = 6371008.8
const rad = (d: number) => (d * Math.PI) / 180
export function haversine(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Desnivel positivo con histéresis de 3 m para no sumar el ruido del GPS */
export function elevationGain(eles: (number | null)[]) {
  let gain = 0
  let ref: number | null = null
  for (const e of eles) {
    if (e == null) continue
    if (ref == null) ref = e
    else if (e - ref >= 3) {
      gain += e - ref
      ref = e
    } else if (ref - e >= 3) ref = e
  }
  return gain
}

/* ---------- lectura ---------- */

const num = (s: string | null | undefined) => {
  if (s == null || s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const firstText = (el: Element, names: string[]) => {
  for (const n of names) {
    const found = el.getElementsByTagNameNS('*', n)[0] ?? el.getElementsByTagName(n)[0]
    if (found?.textContent) return found.textContent
  }
  return null
}

// Strava escribe el tipo como número en algunos GPX
const STRAVA_TYPES: Record<string, ActivityKind> = { '1': 'ride', '4': 'hike', '9': 'run', '10': 'walk' }

function guessKind(type: string, name: string): ActivityKind {
  const code = STRAVA_TYPES[type.trim()]
  if (code) return code
  const t = `${type} ${name}`.toLowerCase()
  if (/run|carrera|correr|trote/.test(t)) return 'run'
  if (/ride|cycl|bike|bici|ciclis|mtb|biking/.test(t)) return 'ride'
  if (/hik|sender|trek|montañ|mountain|ruta/.test(t)) return 'hike'
  if (/walk|camin|paseo/.test(t)) return 'walk'
  return 'run'
}

function parseGpx(doc: Document): { name: string; type: string; points: RawPoint[] } {
  const name = firstText(doc.documentElement, ['name']) ?? ''
  const type = firstText(doc.documentElement, ['type']) ?? ''
  let nodes = [...doc.getElementsByTagName('trkpt')]
  if (!nodes.length) nodes = [...doc.getElementsByTagName('rtept')]
  const points = nodes.map((p) => ({
    lat: Number(p.getAttribute('lat')),
    lon: Number(p.getAttribute('lon')),
    ele: num(firstText(p, ['ele'])),
    time: (() => {
      const t = firstText(p, ['time'])
      const ms = t ? Date.parse(t) : NaN
      return Number.isFinite(ms) ? ms : null
    })(),
    hr: num(firstText(p, ['hr'])),
  }))
  return { name, type, points }
}

function parseTcx(doc: Document): { name: string; type: string; points: RawPoint[] } {
  const act = doc.getElementsByTagName('Activity')[0]
  const type = act?.getAttribute('Sport') ?? ''
  const name = firstText(doc.documentElement, ['Notes', 'Name']) ?? ''
  const points = [...doc.getElementsByTagName('Trackpoint')].map((p) => {
    const pos = p.getElementsByTagName('Position')[0]
    const t = firstText(p, ['Time'])
    const ms = t ? Date.parse(t) : NaN
    const hrEl = p.getElementsByTagName('HeartRateBpm')[0]
    return {
      lat: num(pos ? firstText(pos, ['LatitudeDegrees']) : null) ?? NaN,
      lon: num(pos ? firstText(pos, ['LongitudeDegrees']) : null) ?? NaN,
      ele: num(firstText(p, ['AltitudeMeters'])),
      time: Number.isFinite(ms) ? ms : null,
      hr: hrEl ? num(firstText(hrEl, ['Value'])) : null,
    }
  })
  return { name, type, points }
}

/** Lee un archivo .gpx o .tcx */
export function parseActivityFile(text: string): ParsedActivity {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo no es un GPX/TCX válido.')
  const root = doc.documentElement.nodeName.toLowerCase()
  const raw = root.includes('trainingcenter') ? parseTcx(doc) : parseGpx(doc)
  const pts = raw.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90)
  if (pts.length < 2) throw new Error('El archivo no tiene un recorrido con puntos GPS.')

  // Distancia acumulada y tiempo en movimiento (se descuentan las paradas)
  let distance = 0
  let moving = 0
  const cum: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon)
    distance += d
    cum.push(distance)
    const a = pts[i - 1].time
    const b = pts[i].time
    if (a != null && b != null && b > a) {
      const dt = (b - a) / 1000
      if (dt < 300 && d / dt > 0.4) moving += dt
    }
  }
  const t0 = pts.find((p) => p.time != null)?.time ?? null
  const t1 = [...pts].reverse().find((p) => p.time != null)?.time ?? null

  return {
    name: raw.name.trim(),
    kind: guessKind(raw.type, raw.name),
    startedAt: t0,
    durationS: t0 != null && t1 != null && t1 > t0 ? Math.round((t1 - t0) / 1000) : null,
    movingS: t0 != null && moving > 0 ? Math.round(moving) : null,
    distanceM: Math.round(distance),
    elevationGainM: Math.round(elevationGain(pts.map((p) => p.ele))),
    track: simplify(pts, cum, t0),
  }
}

/** Reduce el recorrido a ~1000 puntos (uno cada pocos metros) para guardarlo */
function simplify(pts: RawPoint[], cum: number[], t0: number | null): TrackPoint[] {
  const total = cum[cum.length - 1]
  const step = Math.max(5, total / 1000)
  const out: TrackPoint[] = []
  let last = -Infinity
  const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d
  pts.forEach((p, i) => {
    if (i !== pts.length - 1 && cum[i] - last < step) return
    last = cum[i]
    out.push([
      round(p.lat, 6),
      round(p.lon, 6),
      p.ele != null ? round(p.ele, 1) : null,
      p.time != null && t0 != null ? Math.round((p.time - t0) / 1000) : null,
      p.hr != null ? Math.round(p.hr) : null,
    ])
  })
  return out
}

/* ---------- análisis de un recorrido guardado ---------- */

export function trackDistances(track: TrackPoint[]) {
  const cum = [0]
  for (let i = 1; i < track.length; i++) cum.push(cum[i - 1] + haversine(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1]))
  return cum
}

export type Split = { km: number; distanceM: number; seconds: number; elevation: number }

/** Parciales por kilómetro (el último puede ser parcial) */
export function splits(track: TrackPoint[]): Split[] {
  if (track.length < 2 || track.every((p) => p[3] == null)) return []
  const cum = trackDistances(track)
  const out: Split[] = []
  let startI = 0
  let km = 1
  const timeAt = (i: number) => track[i][3]
  for (let i = 1; i < track.length; i++) {
    const end = i === track.length - 1
    if (cum[i] >= km * 1000 || end) {
      const t0 = timeAt(startI)
      const t1 = timeAt(i)
      const d = cum[i] - cum[startI]
      if (t0 != null && t1 != null && d > 50) {
        const e0 = track[startI][2]
        const e1 = track[i][2]
        out.push({ km, distanceM: d, seconds: t1 - t0, elevation: e0 != null && e1 != null ? Math.round(e1 - e0) : 0 })
      }
      startI = i
      km++
    }
  }
  return out
}

export function avgHeartRate(track: TrackPoint[]) {
  const hr = track.map((p) => p[4]).filter((v): v is number => v != null && v > 0)
  return hr.length ? Math.round(hr.reduce((a, b) => a + b, 0) / hr.length) : null
}

/* ---------- formato ---------- */

export const fmtKm = (m: number) => `${(m / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`

/** Ritmo "5:12 /km" (o velocidad "24,3 km/h" en bici) */
export function fmtPace(seconds: number, meters: number, kind: Kind = 'run') {
  if (!seconds || !meters) return '—'
  if (kind === 'ride') return `${((meters / seconds) * 3.6).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km/h`
  const s = Math.round(seconds / (meters / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`
}

export const paceLabel = (kind: Kind) => (kind === 'ride' ? 'Velocidad' : 'Ritmo')

const TITLE: Record<ActivityKind, string> = { run: 'Carrera', hike: 'Ruta de senderismo', walk: 'Caminata', ride: 'Salida en bici' }

/** "Carrera por la tarde", como Strava */
export function activityTitle(kind: ActivityKind, at: number) {
  const h = new Date(at).getHours()
  const part = h < 6 ? 'de madrugada' : h < 12 ? 'por la mañana' : h < 15 ? 'al mediodía' : h < 21 ? 'por la tarde' : 'por la noche'
  return `${TITLE[kind]} ${part}`
}

/** Enlace de Strava → descarga del GPX.
    Con el número de la actividad se va directo a /export_gpx; los enlaces cortos (strava.app.link)
    se abren tal cual para llegar a la actividad. */
export function stravaGpxLink(text: string): { url: string; direct: boolean } | null {
  const id = text.match(/strava\.com\/activities\/(\d+)/)?.[1] ?? (/^\s*\d{6,}\s*$/.test(text) ? text.trim() : null)
  if (id) return { url: `https://www.strava.com/activities/${id}/export_gpx`, direct: true }
  const short = text.match(/https?:\/\/(?:strava\.app\.link|www\.strava\.com|strava\.com)\/\S+/)?.[0]
  return short ? { url: short, direct: false } : null
}

/** En Android, un enlace de strava.com lo abre la app de Strava en vez de descargar el archivo.
    Con un enlace "intent" se fuerza a abrirlo en Chrome, que sí descarga el GPX. */
export function openInBrowser(url: string) {
  if (/Android/i.test(navigator.userAgent)) {
    const u = new URL(url)
    const intent = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
    window.location.href = intent
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

/* ---------- rutas para seguir ---------- */

export type SavedRoute = {
  id: string
  user_id: string
  title: string
  description: string
  kind: ActivityKind
  distance_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  track: TrackPoint[]
  created_at: string
}

/** Desnivel negativo (bajadas), con la misma histéresis que el positivo */
export const elevationLoss = (eles: (number | null)[]) => elevationGain([...eles].reverse())

/** Tiempo estimado (s). Senderismo y caminata con la regla de Naismith; carrera y bici con un ritmo medio tranquilo. */
export function estimateSeconds(kind: ActivityKind, distanceM: number, gainM: number) {
  const km = distanceM / 1000
  if (kind === 'hike') return (km / 4 + gainM / 600) * 3600
  if (kind === 'walk') return (km / 4.5 + gainM / 800) * 3600
  if (kind === 'ride') return (km / 18 + gainM / 500) * 3600
  return (km * 6 + gainM / 100) * 60 // carrera: 6 min/km + 1 min por cada 100 m de subida
}

/** Exporta un recorrido a GPX (para abrirlo en otra app) */
export function trackToGpx(name: string, track: TrackPoint[], startedAt?: number) {
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)
  const pts = track
    .map((p) => {
      const ele = p[2] != null ? `<ele>${p[2]}</ele>` : ''
      const time = startedAt != null && p[3] != null ? `<time>${new Date(startedAt + p[3] * 1000).toISOString()}</time>` : ''
      return `<trkpt lat="${p[0]}" lon="${p[1]}">${ele}${time}</trkpt>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Heavy" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>${esc(name)}</name><trkseg>\n${pts}\n</trkseg></trk>\n</gpx>\n`
}

/** Punto de la ruta más cercano a una posición. Busca primero cerca del último (para rutas que pasan dos veces por el mismo sitio). */
export function nearestOnRoute(route: TrackPoint[], lat: number, lon: number, hint = 0) {
  const scan = (from: number, to: number) => {
    let best = -1
    let bestD = Infinity
    for (let i = Math.max(0, from); i <= Math.min(route.length - 1, to); i++) {
      const d = haversine(lat, lon, route[i][0], route[i][1])
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return { index: best, distance: bestD }
  }
  const near = scan(hint - 15, hint + 250)
  if (near.distance < 60) return near
  const all = scan(0, route.length - 1)
  return all.distance < near.distance ? all : near
}
