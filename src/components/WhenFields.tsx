import { useState } from 'react'
import './WhenFields.css'

const pad = (n: number) => String(n).padStart(2, '0')
/** Fecha local para <input type="datetime-local"> */
const toLocalInput = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Inicio y duración de un entreno, editables (por si la app se comió tiempo) */
export function WhenFields({
  startedAt,
  durationS,
  onChange,
}: {
  startedAt: number
  durationS: number
  onChange: (v: { startedAt: number; durationS: number }) => void
}) {
  const [h, setH] = useState(String(Math.floor(durationS / 3600)))
  const [m, setM] = useState(String(Math.floor((durationS % 3600) / 60)))
  const [maxDate] = useState(() => toLocalInput(Date.now()))

  const setDuration = (hh: string, mm: string) => {
    setH(hh)
    setM(mm)
    const total = (parseInt(hh || '0', 10) || 0) * 3600 + Math.min(59, parseInt(mm || '0', 10) || 0) * 60
    onChange({ startedAt, durationS: total })
  }

  return (
    <div className="wf">
      <label className="wf-row">
        <span>Inicio</span>
        <input
          type="datetime-local"
          value={toLocalInput(startedAt)}
          max={maxDate}
          onChange={(e) => {
            const t = new Date(e.target.value).getTime()
            if (Number.isFinite(t)) onChange({ startedAt: t, durationS })
          }}
        />
      </label>
      <div className="wf-row">
        <span>Duración</span>
        <span className="wf-dur">
          <input aria-label="Horas" inputMode="numeric" value={h} maxLength={2} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''), m)} />
          <small>h</small>
          <input aria-label="Minutos" inputMode="numeric" value={m} maxLength={2} onChange={(e) => setDuration(h, e.target.value.replace(/\D/g, ''))} />
          <small>min</small>
        </span>
      </div>
    </div>
  )
}
