import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { fmtDuration, fmtSet, fmtVolume, fmtWhen, isActivity, newRecords, SUPERSET_COLORS, supersetIndex, supersetLetter } from '../lib/workouts'
import type { CSSProperties } from 'react'
import { KIND_LABEL } from '../lib/gpx'
import { ActivityBody } from '../components/ActivityView'
import { Icon } from '../components/Icon'
import { ExerciseThumb, PageHeader, Sheet, SheetItem, Spinner } from '../components/ui'
import { SetBadge } from './RoutineEditor'
import { Avatar } from './RoutineDetail'
import { usePhotoUrls } from '../lib/photos'
import { WorkoutSocial } from '../components/WorkoutSocial'
import { PhotoViewer } from '../components/PhotoViewer'
import './WorkoutDetail.css'

/** Detalle de un entreno. Recién terminado, muestra la enhorabuena y los récords. */
export function WorkoutDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { workouts, findExercise, profiles, userId, ready, refresh } = useData()
  const [menu, setMenu] = useState<'main' | 'delete' | null>(null)
  const [viewer, setViewer] = useState<number | null>(null)
  const w = workouts.find((x) => x.id === id)
  const fresh = params.get('nuevo') === '1'

  // Fotos privadas: enlaces firmados (recordados en el móvil)
  const photoUrls = usePhotoUrls(w?.photos ?? [])

  if (!ready) return <Spinner />
  if (!w) {
    return (
      <>
        <PageHeader title="Entreno" />
        <p className="empty">Este entreno no existe o no es visible.</p>
      </>
    )
  }

  const mine = w.user_id === userId
  const activity = isActivity(w)
  const author = profiles.find((p) => p.id === w.user_id)
  const records = newRecords(w, workouts, findExercise)
  const count = workouts.filter((x) => x.user_id === w.user_id && x.started_at <= w.started_at).length

  async function remove() {
    if (!w) return
    if (w.photos.length) await supabase.storage.from('workout-photos').remove(w.photos)
    const { error } = await supabase.from('workouts').delete().eq('id', w.id)
    setMenu(null)
    if (error) return toast('No se pudo eliminar el entreno')
    await refresh()
    toast('Entreno eliminado')
    navigate('/', { replace: true })
  }

  return (
    <div className="wd">
      <PageHeader
        title={fresh ? (activity ? 'Actividad guardada' : 'Entreno guardado') : activity ? KIND_LABEL[w.kind!] : 'Entreno'}
        left={
          fresh ? (
            <button className="text-btn" onClick={() => navigate('/', { replace: true })}>
              Hecho
            </button>
          ) : undefined
        }
        right={
          mine && (
            <button className="header-btn" aria-label="Opciones del entreno" onClick={() => setMenu('main')}>
              <Icon name="more" />
            </button>
          )
        }
      />
      <div className="wd-body">
        {fresh && (
          <section className="wd-congrats">
            <span className="wd-medal" aria-hidden="true">
              <Icon name="trophy" size={40} stroke={1.6} />
            </span>
            <h2>¡Buen trabajo!</h2>
            <p>Este es tu entreno número {count}.</p>
          </section>
        )}

        <section className="wd-head">
          <Avatar url={author?.avatar_url} name={author?.full_name} size={44} />
          <div>
            <b>{author?.full_name || 'Usuario'}</b>
            <span>{fmtWhen(w.started_at)}</span>
          </div>
        </section>
        {w.photos.length > 0 && (
          <div className="wd-photos">
            {w.photos.map((path, i) => (
              <button key={path} onClick={() => photoUrls[i] && setViewer(i)} aria-label={`Ver foto ${i + 1} del entreno`}>
                {photoUrls[i] && <img src={photoUrls[i]} alt="" crossOrigin="anonymous" />}
              </button>
            ))}
          </div>
        )}
        <h1 className="wd-title">{w.title}</h1>
        {w.description && <p className="wd-desc">{w.description}</p>}

        {activity ? (
          <ActivityBody workout={w} />
        ) : (
          <div className="wd-stats">
            <div>
              <span>Duración</span>
              <b>{fmtDuration(w.duration_s)}</b>
            </div>
            <div>
              <span>Volumen</span>
              <b>{fmtVolume(w.volume_kg)}</b>
            </div>
            <div>
              <span>Series</span>
              <b>{w.sets_count}</b>
            </div>
            <div>
              <span>Récords</span>
              <b>{records.length}</b>
            </div>
          </div>
        )}

        {viewer != null && <PhotoViewer urls={photoUrls} start={viewer} onClose={() => setViewer(null)} />}

        <WorkoutSocial workout={w} preview={3} />

        {!activity && (
          <>
            {records.length > 0 && (
              <section className="card wd-records">
                <h2 className="section-title">Récords nuevos</h2>
                {records.map((r, i) => (
                  <div key={i} className="wd-record">
                    <span className="wd-pr">PR</span>
                    <div>
                      <b>{findExercise(r.exerciseId)?.name ?? 'Ejercicio'}</b>
                      <span>
                        {r.label}: {r.value}
                      </span>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="wd-list">
              <h2 className="section-title">Entreno</h2>
              {w.exercises.map((e, i) => {
                const ex = findExercise(e.exerciseId)
                let n = 0
                const g = e.supersetId ? supersetIndex(w.exercises).get(e.supersetId) : undefined
                return (
                  <article
                    key={i}
                    className={`wd-ex ${g != null ? 'ss-card' : ''}`}
                    style={g != null ? ({ '--ss': SUPERSET_COLORS[g % SUPERSET_COLORS.length] } as CSSProperties) : undefined}
                  >
                    {g != null && <span className="ss-label">Superserie {supersetLetter(g)}</span>}
                    <button className="wd-ex-head" onClick={() => navigate(`/ejercicio/${encodeURIComponent(e.exerciseId)}`)}>
                      <ExerciseThumb exercise={ex} />
                      <b>{ex?.name ?? 'Ejercicio no disponible'}</b>
                    </button>
                    {e.notes && <p className="wd-notes">{e.notes}</p>}
                    <div className="wd-sets">
                      <div className="wd-set head">
                        <span>SERIE</span>
                        <span>PESO Y REPS</span>
                      </div>
                      {e.sets.map((s, k) => {
                        if (s.type !== 'warmup') n++
                        return (
                          <div key={k} className="wd-set">
                            <SetBadge type={s.type} n={n} />
                            <span className="tnum">{fmtSet(s, ex?.type ?? 'weight_reps')}</span>
                          </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </section>
          </>
        )}
      </div>

      <Sheet open={menu === 'main'} onClose={() => setMenu(null)} title={w.title}>
        <SheetItem icon={<Icon name="edit" size={20} />} onClick={() => navigate(`/entreno/${w.id}/editar`)}>
          Editar entreno
        </SheetItem>
        <SheetItem danger icon={<Icon name="trash" size={20} />} onClick={() => setMenu('delete')}>
          Eliminar entreno
        </SheetItem>
      </Sheet>
      <Sheet open={menu === 'delete'} onClose={() => setMenu(null)} title="¿Eliminar entreno?">
        <div className="sheet-confirm">
          <p>Se borrará con sus series y fotos. No se puede deshacer.</p>
          <button className="btn btn-danger btn-block" onClick={remove}>
            Eliminar entreno
          </button>
          <button className="btn btn-block" onClick={() => setMenu(null)}>
            Cancelar
          </button>
        </div>
      </Sheet>
    </div>
  )
}
