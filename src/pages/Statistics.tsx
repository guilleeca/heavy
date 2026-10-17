import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../data/context'
import { KindIcon } from '../components/Icon'
import { BodyMap } from '../components/BodyMap'
import { ExerciseThumb, PageHeader } from '../components/ui'
import { MUSCLE_LABEL, type Muscle } from '../lib/exercises'
import { inPeriod, PERIODS, setsByMuscle, summary, topExercises, type PeriodKey } from '../lib/stats'
import { fmtDuration, fmtVolume, type Workout } from '../lib/workouts'
import { fmtPace, KIND_LABEL, type ActivityKind } from '../lib/gpx'
import {
  activities,
  activityRecords,
  activitySummary,
  distanceByKind,
  EFFORTS,
  fmtKmShort,
  fmtMeters,
  fmtRaceTime,
  gymOnly,
  type Record as Rec,
} from '../lib/activityStats'
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
  const all = workouts.filter((w) => w.user_id === userId)
  const hasActivities = all.some((w) => w.kind && w.kind !== 'gym')
  const [mode, setMode] = useState<'gym' | 'act'>(() => (sessionStorage.getItem('heavy.statsMode') === 'act' ? 'act' : 'gym'))
  useEffect(() => {
    try {
      sessionStorage.setItem('heavy.statsMode', mode)
    } catch {
      /* sin almacenamiento */
    }
  }, [mode])
  const showAct = hasActivities && mode === 'act'
  const mine = showAct ? activities(all) : gymOnly(all)
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
        {hasActivities && (
          <div className="st-mode" role="group" aria-label="Tipo">
            <button aria-pressed={!showAct} onClick={() => setMode('gym')}>
              <KindIcon kind="gym" size={16} /> Gimnasio
            </button>
            <button aria-pressed={showAct} onClick={() => setMode('act')}>
              <KindIcon kind="run" size={16} /> Carreras y rutas
            </button>
          </div>
        )}
        <div className="st-periods" role="group" aria-label="Periodo">
          {PERIODS.map((x) => (
            <button key={x.key} aria-pressed={period === x.key} onClick={() => setPeriod(x.key)}>
              {x.label}
            </button>
          ))}
        </div>

        {showAct ? (
          <ActivityStats
            list={mine}
            prev={inPeriod(mine, days, now, 1)}
            compare={compare}
            periodLabel={PERIODS.find((x) => x.key === period)!.label}
            all={activities(all)}
          />
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}

/** Carreras y rutas: totales del periodo, reparto por tipo y récords de siempre */
function ActivityStats({
  list,
  prev,
  compare,
  periodLabel,
  all,
}: {
  list: Workout[]
  prev: Workout[]
  compare: boolean
  periodLabel: string
  all: Workout[]
}) {
  const navigate = useNavigate()
  const s = activitySummary(list)
  const p = activitySummary(prev)
  const kinds = distanceByKind(list)
  const maxKm = kinds[0]?.[1].distance || 1
  const present = distanceByKind(all).map(([k]) => k)
  const [kind, setKind] = useState<ActivityKind>(present.includes('run') ? 'run' : present[0])
  const r = activityRecords(all, kind)
  const open = (rec: Rec | null) => rec && navigate(`/entreno/${rec.workoutId}`)
  const when = (rec: Rec) => rec.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  const rows: { label: string; rec: Rec | null; fmt: (v: number) => string }[] = [
    ...EFFORTS.map((e, i) => ({ label: `Mejor ${e.label}`, rec: r.efforts[i], fmt: fmtRaceTime })).filter((x) => x.rec),
    { label: 'Más lejos', rec: r.longest, fmt: fmtKmShort },
    { label: 'Más desnivel', rec: r.climb, fmt: fmtMeters },
    { label: 'Más tiempo', rec: r.duration, fmt: fmtDuration },
    { label: kind === 'ride' ? 'Más rápida (media)' : 'Mejor ritmo medio', rec: r.pace, fmt: (v) => fmtPace(v, 1000, kind) },
  ]

  return (
    <>
      <section className="st-cards">
        <div>
          <span>Actividades</span>
          <b className="tnum">{s.count}</b>
          <Delta now={s.count} before={p.count} show={compare} />
        </div>
        <div>
          <span>Distancia</span>
          <b className="tnum">{fmtKmShort(s.distance)}</b>
          <Delta now={s.distance} before={p.distance} show={compare} />
        </div>
        <div>
          <span>Desnivel +</span>
          <b className="tnum">{fmtMeters(s.elevation)}</b>
          <Delta now={s.elevation} before={p.elevation} show={compare} />
        </div>
        <div>
          <span>Tiempo</span>
          <b className="tnum">{fmtDuration(s.time)}</b>
          <Delta now={s.time} before={p.time} show={compare} />
        </div>
      </section>
      {compare && <p className="st-note">Comparado con los {periodLabel} anteriores.</p>}

      <section className="stack">
        <h2 className="section-title">Por tipo</h2>
        {kinds.length ? (
          <div className="st-muscles">
            {kinds.map(([k, v]) => (
              <div key={k} className="st-muscle st-kind">
                <span>
                  <KindIcon kind={k} size={16} /> {KIND_LABEL[k]} <small className="st-count">· {v.count}</small>
                </span>
                <div className="st-bar">
                  <i style={{ width: `${(v.distance / maxKm) * 100}%` }} />
                </div>
                <b className="tnum">{fmtKmShort(v.distance)}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="st-note">No hay actividades en este periodo.</p>
        )}
      </section>

      {present.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Récords</h2>
          {present.length > 1 && (
            <div className="st-periods" role="group" aria-label="Tipo de actividad">
              {present.map((k) => (
                <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
                  <KindIcon kind={k} size={16} /> {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          )}
          <div className="st-records">
            {rows
              .filter((x) => x.rec)
              .map((x) => (
                <button key={x.label} className="st-record" onClick={() => open(x.rec)}>
                  <span>
                    <b>{x.label}</b>
                    <small>
                      {x.rec!.title} · {when(x.rec!)}
                    </small>
                  </span>
                  <strong className="tnum">{x.fmt(x.rec!.value)}</strong>
                </button>
              ))}
          </div>
          <p className="st-note">
            Récords de todas tus actividades, no solo del periodo.
            {(kind === 'run' || kind === 'walk') && ' Las mejores marcas salen del tramo más rápido de cada recorrido con tiempos.'}
          </p>
        </section>
      )}
    </>
  )
}
