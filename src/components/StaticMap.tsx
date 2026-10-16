import { useEffect, useRef, useState } from 'react'
import type { TrackPoint } from '../lib/gpx'
import './StaticMap.css'

/* Mapa ligero para las tarjetas: unas pocas teselas de OpenStreetMap + el recorrido dibujado encima.
   Sin librerías, para que el Inicio con muchas actividades vaya fluido. */

const TILE = 256
// Mapa de OpenStreetMap (gratis, sin clave). Se oscurece con CSS para el tema oscuro.
export const TILE_URL = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
export const MAP_ATTRIBUTION = '© OpenStreetMap'

const project = (lat: number, lon: number, z: number) => {
  const scale = TILE * 2 ** z
  const s = Math.sin((lat * Math.PI) / 180)
  return { x: ((lon + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale }
}

export function StaticMap({ track, className }: { track: TrackPoint[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  let content = null
  if (size && size.w > 0 && track.length > 1) {
    const { w, h } = size
    const lats = track.map((p) => p[0])
    const lons = track.map((p) => p[1])
    const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)]
    const pad = 28
    // Mayor zoom en el que cabe todo el recorrido
    let z = 16
    for (; z > 2; z--) {
      const a = project(maxLat, minLon, z)
      const b = project(minLat, maxLon, z)
      if (b.x - a.x <= w - pad * 2 && b.y - a.y <= h - pad * 2) break
    }
    const a = project(maxLat, minLon, z)
    const b = project(minLat, maxLon, z)
    const left = (a.x + b.x) / 2 - w / 2
    const top = (a.y + b.y) / 2 - h / 2
    const tiles = []
    const n = 2 ** z
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + h) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue
        tiles.push(
          <img
            key={`${tx}-${ty}`}
            src={TILE_URL(z, ((tx % n) + n) % n, ty)}
            alt=""
            className="sm-tile"
            loading="lazy"
            decoding="async"
            style={{ left: tx * TILE - left, top: ty * TILE - top }}
          />,
        )
      }
    }
    const pts = track.map((p) => project(p[0], p[1], z)).map((p) => `${(p.x - left).toFixed(1)},${(p.y - top).toFixed(1)}`)
    const [sx, sy] = pts[0].split(',').map(Number)
    const [ex, ey] = pts[pts.length - 1].split(',').map(Number)
    content = (
      <>
        {tiles}
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polyline points={pts.join(' ')} className="sm-casing" />
          <polyline points={pts.join(' ')} className="sm-route" />
          <circle cx={ex} cy={ey} r={5.5} className="sm-end" />
          <circle cx={sx} cy={sy} r={5.5} className="sm-start" />
        </svg>
        <span className="sm-attr">{MAP_ATTRIBUTION}</span>
      </>
    )
  }

  return (
    <div ref={ref} className={`sm ${className ?? ''}`} role="img" aria-label="Mapa del recorrido">
      {content}
    </div>
  )
}
