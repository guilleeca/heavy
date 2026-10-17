import { useState } from 'react'
import { fmtKg } from '../lib/workouts'
import './PlateCalculator.css'

const BARS = [
  { kg: 20, label: 'Olímpica 20 kg' },
  { kg: 15, label: '15 kg' },
  { kg: 10, label: 'Barra Z 10 kg' },
  { kg: 0, label: 'Sin barra' },
]

/** Discos de gimnasio con sus colores (norma de competición) */
const PLATES = [
  { kg: 25, color: '#d93b3b', h: 100 },
  { kg: 20, color: '#2f6fdb', h: 100 },
  { kg: 15, color: '#e8b923', h: 92 },
  { kg: 10, color: '#2e9e5b', h: 84 },
  { kg: 5, color: '#e8e8e8', h: 66 },
  { kg: 2.5, color: '#d93b3b', h: 54 },
  { kg: 1.25, color: '#9aa0a6', h: 46 },
]

const BAR_KEY = 'heavy.plateBar'
const OFF_KEY = 'heavy.platesOff'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sin almacenamiento */
  }
}

/** Discos por lado para un peso total (de mayor a menor) */
function platesFor(total: number, bar: number, available: number[]) {
  let side = Math.max(0, (total - bar) / 2)
  const out: number[] = []
  for (const p of available) {
    while (side + 1e-9 >= p) {
      out.push(p)
      side -= p
    }
  }
  return { plates: out, left: Math.round(side * 2 * 100) / 100 }
}

/** Calculadora de discos: qué poner en cada lado de la barra */
export function PlateCalculator({ initial }: { initial: number | null }) {
  const [text, setText] = useState(initial ? String(initial).replace('.', ',') : '')
  const [bar, setBar] = useState<number>(() => load(BAR_KEY, 20))
  const [off, setOff] = useState<number[]>(() => load(OFF_KEY, []))
  const total = parseFloat(text.replace(',', '.')) || 0
  const available = PLATES.map((p) => p.kg).filter((k) => !off.includes(k))
  const { plates, left } = platesFor(total, bar, available)
  const shown = total > 0 && total >= bar

  return (
    <div className="pc">
      <label className="pc-total">
        <span>Peso total</span>
        <span className="pc-input">
          <input
            inputMode="decimal"
            value={text}
            placeholder="0"
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          kg
        </span>
      </label>

      <div className="pc-chips" role="group" aria-label="Barra">
        {BARS.map((b) => (
          <button
            key={b.kg}
            aria-pressed={bar === b.kg}
            onClick={() => {
              setBar(b.kg)
              save(BAR_KEY, b.kg)
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="pc-bar" aria-hidden="true">
        <span className="pc-sleeve" />
        <span className="pc-collar" />
        {shown &&
          plates.map((p, i) => {
            const plate = PLATES.find((x) => x.kg === p)!
            return (
              <span key={i} className="pc-plate" style={{ background: plate.color, height: `${plate.h}%` }}>
                <small>{fmtKg(p)}</small>
              </span>
            )
          })}
      </div>

      <p className="pc-result">
        {!total ? (
          'Escribe el peso total.'
        ) : total < bar ? (
          'El peso es menor que la barra.'
        ) : plates.length ? (
          <>
            <b>Cada lado:</b> {groupPlates(plates)}
          </>
        ) : (
          'Solo la barra.'
        )}
        {shown && left > 0 && <span className="pc-left"> Faltan {fmtKg(left)} kg que no salen con estos discos.</span>}
      </p>

      <div className="stack">
        <span className="pc-sub">Discos disponibles</span>
        <div className="pc-chips" role="group" aria-label="Discos disponibles">
          {PLATES.map((p) => (
            <button
              key={p.kg}
              aria-pressed={!off.includes(p.kg)}
              onClick={() => {
                const next = off.includes(p.kg) ? off.filter((k) => k !== p.kg) : [...off, p.kg]
                setOff(next)
                save(OFF_KEY, next)
              }}
            >
              <i style={{ background: p.color }} />
              {fmtKg(p.kg)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** "2 × 20 kg + 1 × 5 kg" */
function groupPlates(list: number[]) {
  const counts = new Map<number, number>()
  for (const p of list) counts.set(p, (counts.get(p) ?? 0) + 1)
  return [...counts.entries()].map(([kg, n]) => `${n} × ${fmtKg(kg)} kg`).join(' + ')
}
