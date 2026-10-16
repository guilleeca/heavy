import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackPoint } from '../lib/gpx'
import { MAP_ATTRIBUTION } from './StaticMap'
import './RouteMap.css'

/** Mapa interactivo (Leaflet) del detalle: zoom, mover y punto marcado desde el perfil de altitud */
export default function RouteMap({ track, highlight }: { track: TrackPoint[]; highlight?: number | null }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.CircleMarker | null>(null)

  useEffect(() => {
    if (!el.current || track.length < 2) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'rm-tiles',
      attribution: `<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">${MAP_ATTRIBUTION}</a>`,
    }).addTo(m)
    m.attributionControl.setPrefix(false)
    const latlngs = track.map((p) => [p[0], p[1]] as [number, number])
    const color = getComputedStyle(document.documentElement).getPropertyValue('--route').trim() || '#ff6b2c'
    L.polyline(latlngs, { color: '#000', weight: 8, opacity: 0.5 }).addTo(m)
    const line = L.polyline(latlngs, { color, weight: 4.5, opacity: 1 }).addTo(m)
    L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: '#ff453a', fillOpacity: 1 }).addTo(m)
    L.circleMarker(latlngs[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#2fc65f', fillOpacity: 1 }).addTo(m)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    m.fitBounds(line.getBounds(), { padding: [24, 24] })
    map.current = m
    return () => {
      m.remove()
      map.current = null
      marker.current = null
    }
  }, [track])

  // Punto seleccionado en el perfil de altitud
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (highlight == null || !track[highlight]) {
      marker.current?.remove()
      marker.current = null
      return
    }
    const ll: [number, number] = [track[highlight][0], track[highlight][1]]
    if (!marker.current) marker.current = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1c8cff', fillOpacity: 1 }).addTo(m)
    else marker.current.setLatLng(ll)
  }, [highlight, track])

  return <div ref={el} className="rm" role="application" aria-label="Mapa del recorrido" />
}
