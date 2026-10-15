import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../data/context'
import { BodyMap } from '../components/BodyMap'
import { ExerciseThumb, PageHeader } from '../components/ui'
import { MUSCLE_LABEL, type Muscle } from '../lib/exercises'
import { inPeriod, PERIODS, setsByMuscle, summary, topExercises, type PeriodKey } from '../lib/stats'
import { fmtDuration, fmtVolume } from '../lib/workouts'
import './Statistics.css'

function Delta({ now, before, show }: { now: number; before: number; show: boolean }) {
  if (!show || !before) return null
  const pct = Math.round(((now - before) / before) * 100)
  if (!pct) return <small className="st-delta">= que antes</small>
  return (
    <small className={`st-delta ${pct > 0 ? 'up' : 'down'}`}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%
    </small>
  )
}

/** Estadísticas: resumen del periodo, distribución por músculo y ejercicios más hechos */
export function Statistics() {
  const navigate = useNavigate()
  const { workouts, userId, findExercise } = useData()
  const mine = workouts.filter((w) => w.user_id === userId)
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const [now] = useState(() => Date.now())
  const days = PERIODS.find((p) => p.key === period)!.days
  const list = inPeriod(mine, days, now)
  const prev = inPeriod(mine, days, now, 1)
  const s = summary(list)
  const p = summary(prev)
  const muscles = setsByMuscle(list, findExercise)
  const ranked = (Object.entries(muscles) as [Muscle, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const maxSets = ranked[0]?.[1] ?? 1
  const weights = Object.fromEntries(ranked.map(([m, v]) => [m, Math.max(0.15, v / maxSets)])) as Partial<Record<Muscle, number>>
  const top = topExercises(list).slice(0, 8)
  const compare = days > 0 && prev.length > 0

  return (
    <div className="st">
      <PageHeader title="Estadísticas" />
      <div className="st-body">
        <div className="st-periods" role="group" aria-label="Periodo">
          {PERIODS.map((x) => (
            <button key={x.key} aria-pressed={period === x.key} onClick={() => setPeriod(x.key)}>
              {x.label}
            </button>
          ))}
        </div>

        <section className="st-cards">
          <div>
            <span>Entrenos</span>
            <b className="tnum">{s.count}</b>
            <Delta now={s.count} before={p.count} show={compare} />
          </div>
          <div>
            <span>Duración</span>
            <b className="tnum">{fmtDuration(s.duration)}</b>
            <Delta now={s.duration} before={p.duration} show={compare} />
          </div>
          <div>
            <span>Volumen</span>
            <b className="tnum">{fmtVolume(s.volume)}</b>
            <Delta now={s.volume} before={p.volume} show={compare} />
          </div>
          <div>
            <span>Series</span>
            <b className="tnum">{s.sets}</b>
            <Delta now={s.sets} before={p.sets} show={compare} />
          </div>
        </section>
        {compare && <p className="st-note">Comparado con los {PERIODS.find((x) => x.key === period)!.label} anteriores.</p>}

        <section className="stack">
          <h2 className="section-title">Distribución muscular</h2>
          {ranked.length ? (
            <>
              <div className="card">
                <BodyMap primary={[]} weights={weights} />
              </div>
              <div className="st-muscles">
                {ranked.map(([m, v]) => (
                  <div key={m} className="st-muscle">
                    <span>{MUSCLE_LABEL[m]}</span>
                    <div className="st-bar">
                      <i style={{ width: `${(v / maxSets) * 100}%` }} />
                    </div>
                    <b className="tnum">{Math.round(v)}</b>
                  </div>
                ))}
              </div>
              <p className="st-note">Series por músculo. Los músculos secundarios cuentan media serie.</p>
            </>
          ) : (
            <p className="st-note">No hay entrenos en este periodo.</p>
          )}
        </section>

        {top.length > 0 && (
          <section className="stack">
            <h2 className="section-title">Ejercicios principales</h2>
            <div className="st-top">
              {top.map(([id, v]) => {
                const ex = findExercise(id)
                return (
                  <button key={id} className="st-ex" onClick={() => navigate(`/ejercicio/${encodeURIComponent(id)}`)}>
                    <ExerciseThumb exercise={ex} size={44} />
                    <span className="st-ex-text">
                      <b>{ex?.name ?? 'Ejercicio no disponible'}</b>
                      <small>
                        {v.sessions} {v.sessions === 1 ? 'entreno' : 'entrenos'} · {v.sets} series
                      </small>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
