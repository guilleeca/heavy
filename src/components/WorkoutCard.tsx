import { Link } from 'react-router'
import { useData } from '../data/context'
import { fmtDuration, fmtVolume, fmtWhen, type Workout } from '../lib/workouts'
import { Avatar } from '../pages/RoutineDetail'
import { ExerciseThumb } from './ui'
import './WorkoutCard.css'

/** Tarjeta de entreno para Inicio y Perfil (estilo Hevy). */
export function WorkoutCard({ workout }: { workout: Workout }) {
  const { profiles, findExercise } = useData()
  const author = profiles.find((p) => p.id === workout.user_id)
  const shown = workout.exercises.slice(0, 3)
  const more = workout.exercises.length - shown.length
  return (
    <Link to={`/entreno/${workout.id}`} className="wc">
      <div className="wc-head">
        <Avatar url={author?.avatar_url} name={author?.full_name} size={40} />
        <div>
          <b>{author?.full_name || author?.username || 'Usuario'}</b>
          <span>{fmtWhen(workout.started_at)}</span>
        </div>
      </div>
      <h3 className="wc-title">{workout.title}</h3>
      {workout.description && <p className="wc-desc">{workout.description}</p>}
      <div className="wc-stats">
        <div>
          <span>Duración</span>
          <b>{fmtDuration(workout.duration_s)}</b>
        </div>
        <div>
          <span>Volumen</span>
          <b>{fmtVolume(workout.volume_kg)}</b>
        </div>
        <div>
          <span>Series</span>
          <b>{workout.sets_count}</b>
        </div>
      </div>
      <div className="wc-list">
        {shown.map((e, i) => {
          const ex = findExercise(e.exerciseId)
          return (
            <div key={i} className="wc-ex">
              <ExerciseThumb exercise={ex} size={36} />
              <span>
                {e.sets.length} {e.sets.length === 1 ? 'serie' : 'series'} {ex?.name ?? 'Ejercicio'}
              </span>
            </div>
          )
        })}
        {more > 0 && <span className="wc-more">Ver {more} ejercicio{more === 1 ? '' : 's'} más</span>}
      </div>
    </Link>
  )
}
