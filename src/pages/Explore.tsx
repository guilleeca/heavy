import { Link } from 'react-router'
import { useData } from '../data/context'
import { PageHeader, Spinner } from '../components/ui'
import { Avatar } from './RoutineDetail'
import './Workout.css'

/** Explorar: las rutinas de la otra persona, para verlas y copiarlas. */
export function Explore() {
  const { routines, profiles, userId, findExercise, ready } = useData()
  const others = profiles.filter((p) => p.id !== userId)

  return (
    <>
      <PageHeader title="Explorar rutinas" />
      <div className="screen-body" style={{ paddingTop: 16 }}>
        {!ready ? (
          <Spinner />
        ) : others.length === 0 ? (
          <p className="empty">Cuando tu hermano entre en Heavy, aquí verás sus rutinas.</p>
        ) : (
          others.map((p) => {
            const list = routines.filter((r) => r.user_id === p.id)
            return (
              <section key={p.id} className="stack">
                <div className="wk-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
                  <Avatar url={p.avatar_url} name={p.full_name} size={32} />
                  <h2 className="section-title">Rutinas de {p.full_name || p.username || 'tu hermano'}</h2>
                </div>
                {list.length === 0 ? (
                  <p className="empty" style={{ padding: 16 }}>
                    Todavía no ha creado rutinas.
                  </p>
                ) : (
                  list.map((r) => (
                    <Link key={r.id} to={`/rutina/${r.id}`} className="wk-card">
                      <div className="wk-card-main">
                        <h3>{r.title}</h3>
                        <p>{r.exercises.map((e) => findExercise(e.exerciseId)?.name ?? '—').join(', ')}</p>
                      </div>
                    </Link>
                  ))
                )}
              </section>
            )
          })
        )}
      </div>
    </>
  )
}
