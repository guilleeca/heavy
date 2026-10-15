import { useParams } from 'react-router'
import { useData } from '../data/context'
import { fmtClock, fmtVolume } from '../lib/workouts'
import { useNow } from '../workout/useNow'
import { ExerciseThumb, PageHeader } from '../components/ui'
import { Avatar } from './RoutineDetail'
import './LiveView.css'

/** Ver en tiempo real el entreno que está haciendo el otro. */
export function LiveView() {
  const { userId } = useParams()
  const { live, profiles, findExercise } = useData()
  const now = useNow(1000)
  const s = live.find((x) => x.user_id === userId)
  const p = profiles.find((x) => x.id === userId)
  const name = p?.full_name || 'Tu hermano'

  return (
    <div className="lv">
      <PageHeader title="En directo" />
      <div className="lv-body">
        {!s ? (
          <p className="empty">{name} no está entrenando ahora mismo.</p>
        ) : (
          <>
            <section className="lv-head">
              <Avatar url={p?.avatar_url} name={name} size={52} />
              <div>
                <span className="lv-dot">En directo</span>
                <b>{name}</b>
                <span>{s.title}</span>
              </div>
            </section>
            <div className="lv-stats">
              <div>
                <span>Duración</span>
                <b className="tnum">{fmtClock((now - new Date(s.started_at).getTime()) / 1000)}</b>
              </div>
              <div>
                <span>Volumen</span>
                <b className="tnum">{fmtVolume(s.snapshot.volume ?? 0)}</b>
              </div>
              <div>
                <span>Series</span>
                <b className="tnum">
                  {s.snapshot.setsDone ?? 0}/{s.snapshot.setsTotal ?? 0}
                </b>
              </div>
            </div>
            <section className="lv-list">
              {(s.snapshot.exercises ?? []).map((e, i) => {
                const ex = findExercise(e.exerciseId)
                const isCurrent = e.exerciseId === s.snapshot.current
                return (
                  <div key={i} className={`lv-ex ${isCurrent ? 'current' : ''} ${e.done === e.total ? 'finished' : ''}`}>
                    <ExerciseThumb exercise={ex} />
                    <div>
                      <b>{ex?.name ?? 'Ejercicio'}</b>
                      <span>
                        {e.done}/{e.total} series{e.last ? ` · última: ${e.last}` : ''}
                      </span>
                    </div>
                    {isCurrent && <span className="lv-now">Ahora</span>}
                  </div>
                )
              })}
            </section>
            <p className="lv-note">Se actualiza solo cada vez que {name} completa una serie.</p>
          </>
        )}
      </div>
    </div>
  )
}
