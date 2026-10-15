import { Link } from 'react-router'
import { useData } from '../data/context'
import { fmtClock } from '../lib/workouts'
import { useNow } from '../workout/useNow'
import { Icon } from '../components/Icon'
import { WorkoutCard } from '../components/WorkoutCard'
import { Spinner } from '../components/ui'
import { Avatar } from './RoutineDetail'
import './Feed.css'
import './LiveView.css'

/** Inicio: quién entrena ahora mismo y los últimos entrenos de los dos. */
export function Feed() {
  const { workouts, live, profiles, userId, findExercise, ready } = useData()
  const now = useNow(1000)
  const others = live.filter((l) => l.user_id !== userId)

  return (
    <>
      <header className="screen-header">
        <h1>Inicio</h1>
      </header>
      <div className="screen-body">
        {others.map((l) => {
          const p = profiles.find((x) => x.id === l.user_id)
          const current = l.snapshot.current ? findExercise(l.snapshot.current)?.name : null
          return (
            <Link key={l.user_id} to={`/en-directo/${l.user_id}`} className="feed-live">
              <Avatar url={p?.avatar_url} name={p?.full_name} size={44} />
              <div>
                <span className="live-pill">En directo</span>
                <b>{p?.full_name || 'Tu hermano'} está entrenando</b>
                <span className="feed-live-sub">
                  {current ? `${current} · ` : ''}
                  {l.snapshot.setsDone ?? 0} series · <span className="tnum">{fmtClock((now - new Date(l.started_at).getTime()) / 1000)}</span>
                </span>
              </div>
              <Icon name="chevronRight" size={18} />
            </Link>
          )
        })}

        {!ready ? (
          <Spinner />
        ) : workouts.length === 0 ? (
          <div className="empty">
            <Icon name="dumbbell" size={44} stroke={1.5} />
            <strong>Todavía no hay entrenamientos</strong>
            <p>Cuando tú o tu hermano terminéis un entreno, aparecerá aquí.</p>
          </div>
        ) : (
          workouts.slice(0, 40).map((w) => <WorkoutCard key={w.id} workout={w} />)
        )}
      </div>
    </>
  )
}
