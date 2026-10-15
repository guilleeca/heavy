import type { Muscle } from '../lib/exercises'
import './BodyMap.css'

/* Muñeco propio de Heavy (delante y detrás), proporciones humanas y músculos
   de formas suaves. Cada forma se define con puntos de la mitad izquierda
   (x < 50) en un lienzo de 100 × 212, se suaviza con curvas y se refleja. */

type Pt = [number, number]
type Shape = { m: Muscle | null; pts: Pt[] }

/** Curva suave que pasa por los puntos (Catmull-Rom → Bézier) */
function smooth(pts: Pt[], closed = true) {
  const n = pts.length
  const p = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]
  let d = `M${pts[0][0]} ${pts[0][1]}`
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0]} ${p2[1]}`
  }
  return d + (closed ? 'Z' : '')
}

/** Silueta: mitad izquierda, de la nuca a la entrepierna */
const SILHOUETTE: Pt[] = [
  [50, 27], [45.6, 27.5], [44.8, 31.5], [38, 34.5], [31, 37], [26.5, 42], [25.2, 50], [24.2, 60], [23.8, 70], [23, 79],
  [20.8, 90], [19.4, 101], [18.6, 108], [17.4, 113], [18.2, 119], [21, 120.5], [23.4, 116], [24.2, 109], [26.2, 98],
  [29.2, 86], [31, 76], [32.4, 64], [34.2, 58.5], [35.6, 68], [36.8, 82], [37.6, 94], [36.6, 104], [35, 116],
  [34.8, 130], [36.4, 146], [38.2, 156], [37.2, 168], [37.8, 182], [39.4, 196], [38.4, 203], [39.6, 207.5], [45.6, 207.5],
  [46.2, 202], [46.6, 194], [47.6, 178], [47.4, 162], [47, 154], [48.2, 138], [49.2, 124], [50, 116],
]

const HEAD = 'M50 4.5c5.4 0 8.9 4.6 8.9 10.4 0 6.8-4 12.6-8.9 12.6s-8.9-5.8-8.9-12.6C41.1 9.1 44.6 4.5 50 4.5Z'

const FRONT: Shape[] = [
  { m: 'neck', pts: [[46.4, 28], [48.2, 34], [46.2, 35.4], [44.8, 31]] },
  { m: 'traps', pts: [[45.2, 32.4], [39, 35.2], [34.8, 37], [40.4, 37.4], [46, 35.8]] },
  { m: 'shoulders', pts: [[35.6, 37.6], [30, 38.6], [26.8, 43], [26, 50.5], [27.6, 55], [30.6, 50.6], [33.8, 44.6], [37.2, 40.4]] },
  { m: 'chest', pts: [[49.2, 39.2], [42, 38.6], [37.6, 41], [34.4, 46.4], [33.6, 52.4], [37.4, 56.6], [43.2, 57.8], [49.2, 56.6]] },
  { m: 'biceps', pts: [[30.4, 54.6], [27, 57.8], [25.6, 64], [25.6, 71], [27.2, 76.6], [29.8, 75.2], [31.2, 68], [32, 60.6]] },
  { m: 'forearms', pts: [[28.6, 80], [25.4, 82.6], [22.6, 89.6], [20.8, 98], [20.2, 106], [22.8, 106.8], [25, 99], [27.6, 91], [29.8, 84]] },
  { m: 'abdominals', pts: [[49.2, 59.4], [44.6, 59.8], [44.2, 67], [49.2, 66.8]] },
  { m: 'abdominals', pts: [[49.2, 68.6], [44.2, 68.8], [44.2, 76.2], [49.2, 76]] },
  { m: 'abdominals', pts: [[49.2, 77.8], [44.2, 78], [44.4, 86.2], [49.2, 86]] },
  { m: 'abdominals', pts: [[49.2, 88], [44.6, 88.2], [45.6, 98], [47.8, 103.6], [49.2, 104]] },
  { m: 'abdominals', pts: [[42.6, 59.6], [37.4, 58.6], [35.8, 64], [36.8, 76], [37.6, 88], [39.2, 96.4], [43.2, 99.6], [42.8, 86], [42.4, 72]] },
  { m: 'quadriceps', pts: [[37.4, 106.6], [35.6, 116], [35.6, 130], [37.2, 142], [39.8, 150.8], [43.4, 151.6], [46, 146], [47, 134], [46.8, 120], [44, 110.6]] },
  { m: 'adductors', pts: [[45.6, 111], [48, 116], [48.8, 124], [47.6, 134], [46.6, 126], [45.8, 117]] },
  { m: 'calves', pts: [[39.2, 158.6], [37.8, 168], [38.4, 180], [40.2, 192], [42.2, 192.6], [42.4, 180], [42, 166]] },
  { m: 'calves', pts: [[43.4, 160], [44.8, 170], [45.8, 182], [45.2, 192], [46.6, 186], [47.2, 172], [46.4, 161]] },
]

const BACK: Shape[] = [
  { m: 'traps', pts: [[50, 27.4], [46, 29.6], [44.4, 33], [36.6, 36.2], [41, 41], [45.4, 50], [48.4, 60], [50, 63]] },
  { m: 'shoulders', pts: [[35.6, 37.4], [30, 38.6], [26.8, 43], [26, 50.5], [27.6, 55], [31, 50.8], [34, 45], [36.6, 40]] },
  { m: 'upper_back', pts: [[37.4, 41.6], [34.8, 46.4], [36.6, 51], [41.6, 53.4], [44.4, 51], [41.6, 45]] },
  { m: 'lats', pts: [[35.2, 50.8], [34.6, 58], [35.6, 68], [38.2, 79], [42.6, 88], [47.6, 90.6], [47.6, 76], [46, 62.6], [41.6, 55.8]] },
  { m: 'triceps', pts: [[30.2, 54.8], [26.8, 58], [25.4, 64.6], [25.6, 71.6], [27.6, 77], [30.2, 74.6], [31.6, 67], [32, 60]] },
  { m: 'forearms', pts: [[28.6, 80], [25.4, 82.6], [22.6, 89.6], [20.8, 98], [20.2, 106], [22.8, 106.8], [25, 99], [27.6, 91], [29.8, 84]] },
  { m: 'lower_back', pts: [[49.2, 82], [45.6, 88.6], [44, 96], [44.8, 103.6], [49.2, 104.4]] },
  { m: 'abductors', pts: [[38.2, 97.4], [36.4, 104], [37.6, 108.8], [41.4, 104.6], [42.4, 99.6]] },
  { m: 'glutes', pts: [[42.6, 101.6], [38.6, 107.6], [37, 115], [38.6, 122.4], [43.6, 125.2], [49.2, 123.4], [49.2, 104.2], [45.6, 102.4]] },
  { m: 'hamstrings', pts: [[37.6, 127.2], [36.2, 136], [37, 145], [39.4, 152.4], [42.4, 151], [43.4, 140], [43.2, 128.4]] },
  { m: 'hamstrings', pts: [[44.6, 128.4], [44.6, 140], [45.2, 151.2], [47.2, 149], [48.4, 138], [48.4, 128]] },
  { m: 'calves', pts: [[38.6, 158.6], [37.2, 167], [38, 176], [40.6, 182.4], [42.6, 180], [42.6, 168], [41.8, 159.6]] },
  { m: 'calves', pts: [[43.6, 159.6], [43.4, 170], [44, 180.6], [46, 182], [47.6, 174], [47.4, 164], [46, 158.6]] },
]

type Props = {
  primary: Muscle[]
  secondary?: Muscle[]
  /** Intensidad 0–1 por músculo (resumen de rutina). Si se da, sustituye a primary/secondary. */
  weights?: Partial<Record<Muscle, number>>
  className?: string
}

export function BodyMap({ primary, secondary = [], weights, className }: Props) {
  const level = (m: Muscle | null): number => {
    if (!m) return 0
    if (weights) return weights[m] ?? 0
    if (primary.includes(m)) return 1
    if (secondary.includes(m)) return 0.45
    return 0
  }
  const fill = (m: Muscle | null) => {
    const v = level(m)
    if (v <= 0) return 'var(--body-muscle)'
    if (v >= 0.99) return 'var(--muscle)'
    return `color-mix(in srgb, var(--muscle) ${Math.round(25 + v * 75)}%, var(--muscle-soft))`
  }

  const figure = (shapes: Shape[], dx: number) => (
    <g transform={`translate(${dx} 0)`}>
      {[false, true].map((mirror) => (
        <g key={String(mirror)} transform={mirror ? 'translate(100 0) scale(-1 1)' : undefined}>
          <path d={smooth(SILHOUETTE, false) + 'L50 27Z'} className="bm-skin" />
          {shapes.map((s, i) => (
            <path key={i} d={smooth(s.pts)} fill={fill(s.m)} className="bm-muscle" />
          ))}
        </g>
      ))}
      <path d={HEAD} className="bm-skin" />
    </g>
  )

  return (
    <svg
      className={`bodymap ${className ?? ''}`}
      viewBox="0 0 212 212"
      role="img"
      aria-label={weights ? 'Músculos trabajados en la rutina' : 'Músculos trabajados por el ejercicio'}
    >
      {figure(FRONT, 0)}
      {figure(BACK, 112)}
    </svg>
  )
}
