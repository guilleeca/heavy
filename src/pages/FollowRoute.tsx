import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRoutes } from '../data/useRoutes'
import { fmtKm, nearestOnRoute, trackDistances, type SavedRoute } from '../lib/gpx'
import { keepScreenOn } from '../workout/feedback'
import { Icon } from '../components/Icon'
import { Spinner } from '../components/ui'
import { MAP_ATTRIBUTION } from '../components/StaticMap'
import '../components/RouteMap.css'
import './FollowRoute.css'

const OFF_ROUTE_M = 50

type Fix = { lat: number; lon: number; acc: number; heading: number | null }

/** Seguir una ruta guardada con el GPS: dónde estás, cuánto queda y aviso si te sales (no graba nada) */
export default function FollowRoute() {
  const { id } = useParams()
  const { routes } = useRoutes()
  if (routes == null) return <Spinner />
  const route = routes.find((r) => r.id === id)
  if (!route) return <p className="empty">Esta ruta no existe.</p>
  return <Follow key={route.id} route={route} />
}

function Follow({ route }: { route: SavedRoute }) {
  const navigate = useNavigate()
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const meMarker = useRef<L.Marker | null>(null)
  const following = useRef(true)
  const offCount = useRef(0)
  const progressRef = useRef(0)
  const [fix, setFix] = useState<Fix | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [off, setOff] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [centered, setCentered] = useState(true)

  const cum = useMemo(() => trackDistances(route.track), [route])
  const total = cum[cum.length - 1] ?? 0
  // Subida que queda desde cada punto (histéresis de 3 m, como el desnivel total)
  const gainLeft = useMemo(() => {
    const acc: number[] = []
    let gain = 0
    let ref: number | null = null
    for (const p of route.track) {
      const e = p[2]
      if (e != null) {
        if (ref == null) ref = e
        else if (e - ref >= 3) {
          gain += e - ref
          ref = e
        } else if (ref - e >= 3) ref = e
      }
      acc.push(gain)
    }
    return acc.map((g) => gain - g)
  }, [route])

  // ---------- mapa ----------
  useEffect(() => {
    if (!mapEl.current) return
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: MAP_ATTRIBUTION }).addTo(m)
    m.attributionControl.setPrefix(false)
    const color = getComputedStyle(document.documentElement).getPropertyValue('--route').trim() || '#ff6b2c'
    const ll = route.track.map((p) => [p[0], p[1]] as [number, number])
    L.polyline(ll, { color: '#000', weight: 9, opacity: 0.45 }).addTo(m)
    const line = L.polyline(ll, { color, weight: 5 }).addTo(m)
    L.circleMarker(ll[ll.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: '#ff453a', fillOpacity: 1 }).addTo(m)
    L.circleMarker(ll[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#2fc65f', fillOpacity: 1 }).addTo(m)
    m.fitBounds(line.getBounds(), { padding: [30, 30] })
    m.on('dragstart', () => {
      following.current = false
      setCentered(false)
    })
    map.current = m
    return () => {
      m.remove()
      map.current = null
      meMarker.current = null
    }
  }, [route])

  // ---------- GPS ----------
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      // oxlint-disable-next-line react/set-state-in-effect
      setGpsError('Este móvil no tiene GPS disponible')
      return
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const f: Fix = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, heading: p.coords.heading }
        setGpsError(null)
        setFix(f)

        const m = map.current
        if (m) {
          const arrow =
            f.heading != null && !Number.isNaN(f.heading) ? `<span class="fr-me-arrow" style="transform:rotate(${f.heading}deg)"></span>` : ''
          const icon = L.divIcon({ className: 'fr-me', html: `<span class="fr-me-dot"></span>${arrow}`, iconSize: [28, 28], iconAnchor: [14, 14] })
          if (!meMarker.current) meMarker.current = L.marker([f.lat, f.lon], { icon, interactive: false }).addTo(m)
          else meMarker.current.setLatLng([f.lat, f.lon]).setIcon(icon)
          if (following.current) m.setView([f.lat, f.lon], Math.max(m.getZoom(), 16), { animate: true })
        }

        // Progreso y aviso si te sales (más de 50 m, o más que el error del GPS, dos veces seguidas)
        const near = nearestOnRoute(route.track, f.lat, f.lon, progressRef.current)
        if (near.distance > Math.max(OFF_ROUTE_M, f.acc * 1.5)) {
          offCount.current++
          if (offCount.current === 2) navigator.vibrate?.([300, 150, 300])
          if (offCount.current >= 2) setOff(Math.round(near.distance))
        } else {
          offCount.current = 0
          setOff(null)
          progressRef.current = near.index
          setProgress(near.index)
        }
      },
      (e) => setGpsError(e.code === 1 ? 'Permite la ubicación para Heavy en los ajustes' : 'Buscando señal GPS…'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [route])

  // ---------- pantalla encendida mientras se sigue la ruta ----------
  useEffect(() => {
    let release: () => void = () => {}
    const lock = () => keepScreenOn().then((r) => (release = r))
    lock()
    const onVis = () => document.visibilityState === 'visible' && lock()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      release()
    }
  }, [])

  const done = cum[progress] ?? 0
  const left = Math.max(0, total - done)
  const upLeft = Math.round(gainLeft[progress] ?? 0)
  // Antes de llegar a la ruta no es "salirse": se indica la distancia al inicio
  const toStart = progress === 0 && off != null

  return (
    <div className="fr">
      <div ref={mapEl} className="fr-map" />

      <header className="fr-top">
        <button className="fr-round" aria-label="Salir" onClick={() => navigate(-1)}>
          <Icon name="close" size={22} />
        </button>
        <div className="fr-title">
          <b>{route.title}</b>
          <span className={gpsError ? 'warn' : ''}>{gpsError ?? (fix ? `GPS ±${Math.round(fix.acc)} m` : 'Buscando señal GPS…')}</span>
        </div>
        {!centered && (
          <button
            className="fr-round"
            aria-label="Centrar en mi posición"
            onClick={() => {
              following.current = true
              setCentered(true)
              if (fix) map.current?.setView([fix.lat, fix.lon], Math.max(map.current.getZoom(), 16))
            }}
          >
            <Icon name="locate" size={22} />
          </button>
        )}
      </header>

      {off != null && (
        <div className={`fr-off ${toStart ? 'info' : ''}`} role="alert">
          {toStart ? `Estás a ${fmtKm(off)} de la ruta` : `⚠️ Te has salido de la ruta · ${off} m`}
        </div>
      )}

      <section className="fr-panel">
        <div className="fr-stats">
          <div>
            <span>Hecho</span>
            <b className="tnum">{fmtKm(done)}</b>
          </div>
          <div>
            <span>Quedan</span>
            <b className="tnum">{fmtKm(left)}</b>
          </div>
          <div>
            <span>Subida restante</span>
            <b className="tnum">+{upLeft} m</b>
          </div>
        </div>
        <div className="fr-bar">
          <i style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }} />
        </div>
        <p className="fr-hint">La pantalla se mantiene encendida mientras sigues la ruta. Graba la actividad con Strava como siempre.</p>
      </section>
    </div>
  )
}
