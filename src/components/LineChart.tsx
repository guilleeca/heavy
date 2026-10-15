import { useId, useRef, useState } from 'react'
import './LineChart.css'

export type Point = { date: Date; value: number }

/** Gráfica de línea sencilla (SVG). Tocar o arrastrar selecciona el punto más cercano. */
export function LineChart({ points, format, label }: { points: Point[]; format: (v: number) => string; label: string }) {
  const [sel, setSel] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const gid = useId()
  if (!points.length) return <p className="lc-empty">Sin datos todavía.</p>

  const W = 320
  const H = 150
  const P = { l: 4, r: 4, t: 12, b: 8 }
  const vals = points.map((p) => p.value)
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (min === max) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.12
  min = Math.max(0, min - pad)
  max += pad
  const t0 = points[0].date.getTime()
  const t1 = points[points.length - 1].date.getTime()
  const x = (i: number) =>
    points.length === 1 ? W / 2 : P.l + ((points[i].date.getTime() - t0) / (t1 - t0 || 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const area = `${line}L${x(points.length - 1).toFixed(1)},${H}L${x(0).toFixed(1)},${H}Z`
  const active = sel ?? points.length - 1
  const ap = points[active]

  function pick(clientX: number) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const px = ((clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    setSel(best)
  }

  return (
    <div className="lc">
      <div className="lc-head">
        <b className="tnum">{format(ap.value)}</b>
        <span>{ap.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      <div className="lc-plot">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: de ${format(points[0].value)} a ${format(points[points.length - 1].value)}`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => e.buttons && pick(e.clientX)}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1={x(active)} x2={x(active)} y1={0} y2={H} stroke="var(--text-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="lc-dot" style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(ap.value) / H) * 100}%` }} />
      </div>
      <div className="lc-axis">
        <span>{points[0].date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}</span>
        <span>{points[points.length - 1].date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}</span>
      </div>
    </div>
  )
}
