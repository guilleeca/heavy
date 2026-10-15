import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Exercise } from '../lib/exercises'
import { exerciseRecords, type Best, type Session } from '../lib/stats'
import { fmtClock, fmtKg, fmtSet, fmtVolume } from '../lib/workouts'
import { SetBadge } from '../pages/RoutineEditor'
import { LineChart } from './LineChart'
import { Icon } from './Icon'
import './ExerciseProgress.css'

type Metric = { key: keyof Session; label: string; fmt: (v: number) => string }

const kg = (v: number) => `${fmtKg(v)} kg`
const reps = (v: number) => `${Math.round(v)} reps`

function metricsFor(ex: Exercise): Metric[] {
  if (ex.type === 'duration') return [{ key: 'maxDuration', label: 'Mayor duración', fmt: fmtClock }]
  if (ex.type === 'reps' || ex.type === 'assisted')
    return [
      { key: 'maxReps', label: 'Más reps', fmt: reps },
      { key: 'reps', label: 'Reps totales', fmt: reps },
    ]
  return [
    { key: 'heaviest', label: 'Peso máximo', fmt: kg },
    { key: 'best1rm', label: '1RM estimado', fmt: kg },
    { key: 'bestSetVolume', label: 'Mejor serie', fmt: kg },
    { key: 'volume', label: 'Volumen sesión', fmt: fmtVolume },
    { key: 'reps', label: 'Reps totales', fmt: reps },
  ]
}

const RANGES = [
  { label: '3 meses', days: 91 },
  { label: '1 año', days: 365 },
  { label: 'Todo', days: 0 },
]

const fmtDate = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/** Gráfica de progreso + récords personales (pestaña Resumen) */
export function ExerciseProgress({ exercise, sessions }: { exercise: Exercise; sessions: Session[] }) {
  const navigate = useNavigate()
  const metrics = metricsFor(exercise)
  const [metric, setMetric] = useState(metrics[0])
  const [range, setRange] = useState(RANGES[2])
  const [now] = useState(() => Date.now())
  const rec = useMemo(() => exerciseRecords(sessions), [sessions])

  const shown = sessions.filter((s) => !range.days || now - s.date.getTime() <= range.days * 86400000)
  const points = shown.map((s) => ({ date: s.date, value: s[metric.key] as number })).filter((p) => p.value > 0)

  const rows: { label: string; best: Best | null; fmt: (v: number) => string }[] =
    exercise.type === 'weight_reps'
      ? [
          { label: 'Peso máximo', best: rec.heaviest, fmt: kg },
          { label: '1RM estimado', best: rec.best1rm, fmt: kg },
          { label: 'Mejor volumen en una serie', best: rec.bestSetVolume, fmt: kg },
          { label: 'Mejor volumen en una sesión', best: rec.bestSessionVolume, fmt: fmtVolume },
        ]
      : exercise.type === 'duration'
        ? [{ label: 'Mayor duración', best: rec.maxDuration, fmt: fmtClock }]
        : [
            { label: 'Más repeticiones en una serie', best: rec.maxReps, fmt: reps },
            { label: 'Más repeticiones en una sesión', best: rec.bestSessionReps, fmt: reps },
          ]

  return (
    <>
      <section className="card xp-chart">
        <LineChart points={points} format={metric.fmt} label={metric.label} />
        <div className="xp-ranges" role="group" aria-label="Periodo">
          {RANGES.map((r) => (
            <button key={r.label} aria-pressed={range === r} onClick={() => setRange(r)}>
              {r.label}
            </button>
          ))}
        </div>
        {metrics.length > 1 && (
          <div className="xp-chips" role="group" aria-label="Métrica">
            {metrics.map((m) => (
              <button key={m.key} className="xp-chip" aria-pressed={metric.key === m.key} onClick={() => setMetric(m)}>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">
          <Icon name="trophy" size={18} /> Récords personales
        </h2>
        <div className="xp-records">
          {rows.map((r) => (
            <button key={r.label} className="xp-record" disabled={!r.best} onClick={() => r.best && navigate(`/entreno/${r.best.workoutId}`)}>
              <span>{r.label}</span>
              <b className="tnum">{r.best ? r.fmt(r.best.value) : '—'}</b>
              {r.best && <small>{fmtDate(r.best.date)}</small>}
            </button>
          ))}
        </div>
      </section>

      {exercise.type === 'weight_reps' && rec.byReps.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Récords por repeticiones</h2>
          <div className="xp-table">
            <div className="xp-row head">
              <span>REPS</span>
              <span>MEJOR PESO</span>
              <span>FECHA</span>
            </div>
            {rec.byReps.map(([r, b]) => (
              <button key={r} className="xp-row" onClick={() => navigate(`/entreno/${b.workoutId}`)}>
                <span className="tnum">{r}</span>
                <span className="tnum">{kg(b.value)}</span>
                <span>{b.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/** Pestaña Historial: cada vez que se hizo el ejercicio */
export function ExerciseHistory({ exercise, sessions }: { exercise: Exercise; sessions: Session[] }) {
  const navigate = useNavigate()
  const [limit, setLimit] = useState(20)
  if (!sessions.length) return <p className="exd-note">Aún no has hecho este ejercicio.</p>
  const list = [...sessions].reverse()
  return (
    <div className="xp-history">
      {list.slice(0, limit).map((s) => {
        let n = 0
        return (
          <button key={s.workout.id} className="card xp-session" onClick={() => navigate(`/entreno/${s.workout.id}`)}>
            <div className="xp-session-head">
              <b>{s.workout.title}</b>
              <span>{s.date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="xp-sets">
              {s.sets.map((set, k) => {
                if (set.type !== 'warmup') n++
                return (
                  <div key={k} className="xp-set">
                    <SetBadge type={set.type} n={n} />
                    <span className="tnum">{fmtSet(set, exercise.type)}</span>
                  </div>
                )
              })}
            </div>
          </button>
        )
      })}
      {list.length > limit && (
        <button className="btn btn-block" onClick={() => setLimit(limit + 20)}>
          Ver más
        </button>
      )}
    </div>
  )
}
