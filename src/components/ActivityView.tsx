import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { avgHeartRate, fmtKm, fmtPace, paceLabel, splits, trackDistances, type Kind, type TrackPoint } from '../lib/gpx'
import { fmtDuration, type Workout } from '../lib/workouts'
import { StaticMap } from './StaticMap'
import './ActivityView.css'

const RouteMap = lazy(() => import('./RouteMap'))

/** Detalle de una carrera/ruta: mapa interactivo, cifras, perfil de altitud y parciales */
export function ActivityBody({ workout: w }: { workout: Workout }) {
  const track = useMemo(() => w.track ?? [], [w.track])
  const [sel, setSel] = useState<number | null>(null)
  const kind = (w.kind ?? 'run') as Kind
  const time = w.moving_s || w.duration_s
  const hr = useMemo(() => avgHeartRate(track), [track])
  const maxEle = useMemo(() => Math.max(...track.map((p) => p[2] ?? -Infinity)), [track])

  return (
    <>
      {track.length > 1 && (
        <div className="av-map">
          <Suspense fallback={<StaticMap track={track} className="av-static" />}>
            <RouteMap track={track} highlight={sel} />
          </Suspense>
        </div>
      )}

      <div className="av-stats">
        <div>
          <span>Distancia</span>
          <b className="tnum">{fmtKm(w.distance_m ?? 0)}</b>
        </div>
        <div>
          <span>{w.moving_s ? 'Tiempo en movimiento' : 'Tiempo'}</span>
          <b className="tnum">{fmtDuration(time)}</b>
        </div>
        <div>
          <span>{paceLabel(kind)} medio</span>
          <b className="tnum">{fmtPace(time, w.distance_m ?? 0, kind)}</b>
        </div>
        <div>
          <span>Desnivel +</span>
          <b className="tnum">{Math.round(w.elevation_gain_m ?? 0)} m</b>
        </div>
        {Number.isFinite(maxEle) && (
          <div>
            <span>Altitud máx.</span>
            <b className="tnum">{Math.round(maxEle)} m</b>
          </div>
        )}
        {hr && (
          <div>
            <span>Pulso medio</span>
            <b className="tnum">{hr} ppm</b>
          </div>
        )}
        {w.moving_s != null && w.moving_s < w.duration_s - 60 && (
          <div>
            <span>Tiempo total</span>
            <b className="tnum">{fmtDuration(w.duration_s)}</b>
          </div>
        )}
      </div>

      {track.some((p) => p[2] != null) && <ElevationProfile track={track} selected={sel} onSelect={setSel} />}
      <Splits track={track} kind={kind} />
    </>
  )
}

/** Perfil de altitud: tocar o arrastrar marca el punto en el mapa */
function ElevationProfile({ track, selected, onSelect }: { track: TrackPoint[]; selected: number | null; onSelect: (i: number | null) => void }) {
  const ref = useRef<SVGSVGElement>(null)
  const cum = useMemo(() => trackDistances(track), [track])
  const pts = track.map((p, i) => ({ d: cum[i], e: p[2] })).filter((p): p is { d: number; e: number } => p.e != null)
  if (pts.length < 2) return null
  const W = 320
  const H = 110
  const total = cum[cum.length - 1] || 1
  let min = Math.min(...pts.map((p) => p.e))
  let max = Math.max(...pts.map((p) => p.e))
  if (max - min < 20) {
    const mid = (max + min) / 2
    min = mid - 10
    max = mid + 10
  }
  const x = (d: number) => (d / total) * W
  const y = (e: number) => 8 + (1 - (e - min) / (max - min)) * (H - 16)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.e).toFixed(1)}`).join('')
  const area = `${line}L${W},${H}L0,${H}Z`
  const s = selected != null && track[selected]?.[2] != null ? selected : null

  function pick(clientX: number) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const d = ((clientX - r.left) / r.width) * total
    let best = 0
    for (let i = 1; i < cum.length; i++) if (Math.abs(cum[i] - d) < Math.abs(cum[best] - d)) best = i
    onSelect(best)
  }

  return (
    <section className="card av-elev">
      <div className="av-elev-head">
        <h2 className="section-title">Altitud</h2>
        <span className="tnum">
          {s != null
            ? `km ${(cum[s] / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} · ${Math.round(track[s][2]!)} m`
            : `${Math.round(min)}–${Math.round(max)} m`}
        </span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Perfil de altitud entre ${Math.round(min)} y ${Math.round(max)} metros`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && pick(e.clientX)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onSelect(null)}
      >
        <path d={area} className="av-elev-area" />
        <path d={line} className="av-elev-line" vectorEffect="non-scaling-stroke" />
        {s != null && <line x1={x(cum[s])} x2={x(cum[s])} y1={0} y2={H} className="av-elev-cursor" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="av-axis">
        <span>0 km</span>
        <span>{fmtKm(total)}</span>
      </div>
    </section>
  )
}

/** Parciales por kilómetro con barra según el ritmo */
function Splits({ track, kind }: { track: TrackPoint[]; kind: Kind }) {
  const list = useMemo(() => splits(track), [track])
  if (list.length < 2) return null
  const paces = list.map((s) => s.seconds / (s.distanceM / 1000))
  const fastest = Math.min(...paces)
  const slowest = Math.max(...paces)
  return (
    <section className="stack">
      <h2 className="section-title">Parciales</h2>
      <div className="av-splits">
        <div className="av-split head">
          <span>KM</span>
          <span>{kind === 'ride' ? 'VELOCIDAD' : 'RITMO'}</span>
          <span />
          <span>DESN.</span>
        </div>
        {list.map((s, i) => {
          const pace = paces[i]
          // Más rápido → barra más larga
          const pct = slowest === fastest ? 100 : 45 + ((slowest - pace) / (slowest - fastest)) * 55
          return (
            <div key={s.km} className={`av-split ${pace === fastest ? 'best' : ''}`}>
              <span className="tnum">
                {s.distanceM < 990 ? (s.km - 1 + s.distanceM / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 }) : s.km}
              </span>
              <span className="tnum">{fmtPace(s.seconds, s.distanceM, kind).replace(' /km', '')}</span>
              <span className="av-bar">
                <i style={{ width: `${pct}%` }} />
              </span>
              <span className="tnum">{s.elevation > 0 ? `+${s.elevation}` : s.elevation}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
