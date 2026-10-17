import { toast } from '../lib/toast'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, TYPE_LABEL, gifUrl } from '../lib/exercises'
import { BodyMap } from '../components/BodyMap'
import { PageHeader, Sheet, Spinner } from '../components/ui'
import { Icon } from '../components/Icon'
import { ExerciseHistory, ExerciseProgress } from '../components/ExerciseProgress'
import { exerciseSessions } from '../lib/stats'
import './ExerciseDetail.css'

type Tab = 'resumen' | 'historial' | 'instrucciones'
const TABS: [Tab, string][] = [
  ['resumen', 'Resumen'],
  ['historial', 'Historial'],
  ['instrucciones', 'Instrucciones'],
]

/** Ficha del ejercicio: animación, músculos y cómo se hace. */
export function ExerciseDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { findExercise, ready, userId, refresh, routines, workouts } = useData()
  const [tab, setTab] = useState<Tab>('resumen')
  const [steps, setSteps] = useState<string[] | null>(null)
  const [confirm, setConfirm] = useState(false)
  const ex = findExercise(id)
  const sessions = useMemo(() => (ex ? exerciseSessions(workouts, userId, ex.id, ex.type) : []), [ex, workouts, userId])

  // Instrucciones paso a paso desde ExerciseDB (solo ejercicios de la biblioteca)
  useEffect(() => {
    if (tab !== 'instrucciones' || !ex || ex.custom || steps) return
    fetch(`https://oss.exercisedb.dev/api/v1/exercises/${ex.id}`)
      .then((r) => r.json())
      .then((d) => setSteps((d?.data?.instructions ?? []).map((s: string) => s.replace(/^Step:\d+\s*/, ''))))
      .catch(() => setSteps([]))
  }, [tab, ex, steps])

  if (!ready) return <Spinner />
  if (!ex) {
    return (
      <>
        <PageHeader title="Ejercicio" />
        <p className="empty">Este ejercicio no existe.</p>
      </>
    )
  }

  const src = gifUrl(ex)
  const canDelete = ex.custom && ex.userId === userId
  const usedIn = routines.filter((r) => r.exercises.some((e) => e.exerciseId === ex.id)).length

  async function remove() {
    const { error } = await supabase.from('custom_exercises').delete().eq('id', ex!.id.slice(2))
    setConfirm(false)
    if (error) return toast('No se pudo eliminar el ejercicio')
    await refresh()
    toast('Ejercicio eliminado')
    navigate(-1)
  }

  return (
    <div className="exd">
      <PageHeader
        title="Ejercicio"
        right={
          canDelete && (
            <button className="header-btn" aria-label="Eliminar ejercicio" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={22} />
            </button>
          )
        }
      />
      <div className="exd-tabs" role="tablist">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className="exd-tab" onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      <div className="exd-body">
        {tab === 'historial' ? (
          <ExerciseHistory exercise={ex} sessions={sessions} />
        ) : (
          <>
            {src ? (
              <div className="exd-media">
                <img src={src} alt={`Cómo se hace: ${ex.name}`} />
              </div>
            ) : (
              <div className="exd-media exd-media-empty">
                <Icon name="dumbbell" size={48} stroke={1.4} />
                <span>Ejercicio personalizado</span>
              </div>
            )}

            <h2 className="exd-name">{ex.name}</h2>

            {tab === 'resumen' ? (
              <>
                <section className="card exd-muscles">
                  <BodyMap primary={[ex.muscle]} secondary={ex.secondary} className="exd-map" />
                  <dl className="exd-facts">
                    <div>
                      <dt>
                        <i className="p" /> Principal
                      </dt>
                      <dd>{MUSCLE_LABEL[ex.muscle]}</dd>
                    </div>
                    {ex.secondary.length > 0 && (
                      <div>
                        <dt>
                          <i className="s" /> Secundarios
                        </dt>
                        <dd>{ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Equipamiento</dt>
                      <dd>{EQUIPMENT_LABEL[ex.equipment]}</dd>
                    </div>
                    <div>
                      <dt>Se registra</dt>
                      <dd>{TYPE_LABEL[ex.type]}</dd>
                    </div>
                  </dl>
                </section>
                {sessions.length > 0 && <h2 className="section-title">Progreso</h2>}
                {sessions.length ? (
                  <ExerciseProgress exercise={ex} sessions={sessions} />
                ) : (
                  <p className="exd-note">El progreso y los récords de este ejercicio aparecerán cuando lo hagas en un entreno.</p>
                )}
              </>
            ) : ex.custom ? (
              <p className="exd-note">Los ejercicios personalizados no tienen instrucciones.</p>
            ) : steps == null ? (
              <Spinner />
            ) : steps.length ? (
              <ol className="exd-steps">
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            ) : (
              <p className="exd-note">No se pudieron cargar las instrucciones. Revisa la conexión.</p>
            )}
          </>
        )}
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Eliminar ejercicio?">
        <div className="sheet-confirm">
          <p>{usedIn ? `Se usa en ${usedIn} rutina(s); allí aparecerá como «no disponible».` : 'Se eliminará de tu biblioteca.'}</p>
          <button className="btn btn-danger btn-block" onClick={remove}>
            Eliminar
          </button>
          <button className="btn btn-block" onClick={() => setConfirm(false)}>
            Cancelar
          </button>
        </div>
      </Sheet>
    </div>
  )
}
