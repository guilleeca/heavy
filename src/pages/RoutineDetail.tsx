import type { CSSProperties } from 'react'
import { SUPERSET_COLORS, supersetIndex, supersetLetter } from '../lib/workouts'
import { toast } from '../lib/toast'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import { MUSCLE_LABEL } from '../lib/exercises'
import { estimateMinutes, exerciseSummary, formatRest, setsByMuscle, totalSets } from '../lib/routines'
import { BodyMap } from '../components/BodyMap'
import { Icon } from '../components/Icon'
import { ExerciseThumb, PageHeader, Spinner } from '../components/ui'
import { RoutineMenu } from '../components/RoutineMenu'
import { useStartWorkout } from '../workout/useStartWorkout'
import './RoutineDetail.css'

/** Vista de una rutina con su resumen, como en Hevy. */
export function RoutineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const startWorkout = useStartWorkout()
  const { routines, findExercise, profiles, userId, ready, refresh } = useData()
  const [menu, setMenu] = useState(false)
  const [copying, setCopying] = useState(false)
  const r = routines.find((x) => x.id === id)

  if (!ready) return <Spinner />
  if (!r) {
    return (
      <>
        <PageHeader title="Rutina" />
        <p className="empty">Esta rutina ya no existe.</p>
      </>
    )
  }

  const mine = r.user_id === userId
  const author = profiles.find((p) => p.id === r.user_id)
  const muscles = setsByMuscle(r, findExercise)
  const max = Math.max(1, ...muscles.map(([, n]) => n))
  const weights = Object.fromEntries(muscles.map(([m, n]) => [m, n / max]))

  const nextPosition = Math.max(0, ...routines.filter((x) => x.user_id === userId).map((x) => x.position + 1))

  async function copy() {
    if (!r) return
    setCopying(true)
    const { data, error } = await supabase
      .from('routines')
      .insert({ title: r.title, notes: r.notes, exercises: r.exercises, position: nextPosition })
      .select('id')
      .single()
    setCopying(false)
    if (error || !data) return toast('No se pudo copiar la rutina')
    await refresh()
    toast('Rutina copiada a tus rutinas')
    navigate(`/rutina/${data.id}`, { replace: true })
  }

  return (
    <div className="rd">
      <PageHeader
        title={r.title}
        right={
          mine && (
            <button className="header-btn" aria-label="Opciones de la rutina" onClick={() => setMenu(true)}>
              <Icon name="more" />
            </button>
          )
        }
      />
      <div className="rd-body">
        <section className="rd-author">
          <Avatar url={author?.avatar_url} name={author?.full_name} />
          <div>
            <span>Creado por</span>
            <b>{author?.username || author?.full_name || 'Usuario'}</b>
          </div>
        </section>

        {mine ? (
          <div className="rd-actions">
            <button className="btn btn-primary btn-block" onClick={() => startWorkout(r)}>
              <Icon name="play" size={18} />
              Empezar rutina
            </button>
            <Link className="btn btn-block" to={`/rutina/${r.id}/editar`}>
              <Icon name="edit" size={18} />
              Editar rutina
            </Link>
          </div>
        ) : (
          <button className="btn btn-primary btn-block" onClick={copy} disabled={copying}>
            <Icon name="copy" size={18} />
            {copying ? 'Copiando…' : 'Copiar a mis rutinas'}
          </button>
        )}

        <section className="card rd-summary">
          <h2 className="section-title">Resumen de rutina</h2>
          <div className="rd-stats">
            <div>
              <span>Ejercicios</span>
              <b className="tnum">{r.exercises.length}</b>
            </div>
            <div>
              <span>Series totales</span>
              <b className="tnum">{totalSets(r)}</b>
            </div>
            <div>
              <span>Duración estimada</span>
              <b className="tnum">{estimateMinutes(r)}min</b>
            </div>
          </div>
          <BodyMap primary={[]} weights={weights} className="rd-body-map" />
          <div className="rd-muscles">
            <div className="rd-mrow head">
              <span>Músculo</span>
              <span />
              <span>Series</span>
            </div>
            {muscles.map(([m, n]) => (
              <div key={m} className="rd-mrow">
                <span>{MUSCLE_LABEL[m]}</span>
                <span className="rd-track">
                  <i style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span className="tnum">{String(n).replace('.', ',')}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rd-list">
          {r.exercises.map((re, i) => {
            const ex = findExercise(re.exerciseId)
            const g = re.supersetId ? supersetIndex(r.exercises).get(re.supersetId) : undefined
            return (
              <Link
                key={i}
                to={`/ejercicio/${encodeURIComponent(re.exerciseId)}`}
                className={`rd-ex ${g != null ? 'ss-card rd-ss' : ''}`}
                style={g != null ? ({ '--ss': SUPERSET_COLORS[g % SUPERSET_COLORS.length] } as CSSProperties) : undefined}
              >
                <ExerciseThumb exercise={ex} size={56} />
                <div className="rd-ex-text">
                  {g != null && <span className="ss-label">Superserie {supersetLetter(g)}</span>}
                  <b>{ex?.name ?? 'Ejercicio no disponible'}</b>
                  <span>
                    {exerciseSummary(re)}
                    {re.restSeconds > 0 && (
                      <>
                        {' · '}
                        <Icon name="timer" size={14} className="rd-timer" /> Descansa {formatRest(re.restSeconds)}
                      </>
                    )}
                  </span>
                  {re.notes && <em>{re.notes}</em>}
                </div>
              </Link>
            )
          })}
        </section>
      </div>

      {mine && <RoutineMenu routine={r} open={menu} onClose={() => setMenu(false)} onDeleted={() => navigate('/entrenamiento', { replace: true })} />}
    </div>
  )
}

export function Avatar({ url, name, size = 48 }: { url?: string | null; name?: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      {url ? <img src={url} alt="" referrerPolicy="no-referrer" /> : (name || '?').charAt(0).toUpperCase()}
    </span>
  )
}
