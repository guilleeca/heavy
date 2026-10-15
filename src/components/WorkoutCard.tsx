import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useData } from '../data/context'
import { MUSCLE_LABEL, type Muscle } from '../lib/exercises'
import { setsByMuscle } from '../lib/stats'
import { supabase } from '../lib/supabase'
import { fmtDuration, fmtVolume, fmtWhen, newRecords, type Workout } from '../lib/workouts'
import { Avatar } from '../pages/RoutineDetail'
import { BodyMap } from './BodyMap'
import { Icon } from './Icon'
import { ExerciseThumb } from './ui'
import { WorkoutSocial } from './WorkoutSocial'
import { PhotoViewer } from './PhotoViewer'
import './WorkoutCard.css'

/** Fotos privadas: enlaces firmados de 1 hora (se piden una vez por tarjeta) */
function usePhotoUrls(paths: string[]) {
  const key = paths.join('|')
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    if (!key) return
    let cancelled = false
    supabase.storage
      .from('workout-photos')
      .createSignedUrls(key.split('|'), 3600)
      .then(({ data }) => {
        if (!cancelled) setUrls((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[])
      })
    return () => {
      cancelled = true
    }
  }, [key])
  return key ? urls : []
}

/** Tarjeta de entreno para Inicio y Perfil (estilo Hevy): fotos, resumen y músculos en un carrusel. */
export const WorkoutCard = memo(function WorkoutCard({ workout }: { workout: Workout }) {
  const navigate = useNavigate()
  const { profiles, findExercise, workouts } = useData()
  const author = profiles.find((p) => p.id === workout.user_id)
  const photos = usePhotoUrls(workout.photos)
  const records = useMemo(() => newRecords(workout, workouts, findExercise).length, [workout, workouts, findExercise])
  const muscles = useMemo(() => {
    const m = setsByMuscle([workout], findExercise)
    return (Object.entries(m) as [Muscle, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  }, [workout, findExercise])
  const totalMuscle = muscles.reduce((a, [, v]) => a + v, 0) || 1
  const weights = Object.fromEntries(muscles.map(([m, v]) => [m, Math.max(0.2, v / (muscles[0]?.[1] ?? 1))]))

  const track = useRef<HTMLDivElement>(null)
  const [slide, setSlide] = useState(0)
  const [viewer, setViewer] = useState<number | null>(null)
  const slides = photos.length + 2
  const open = () => navigate(`/entreno/${workout.id}`)
  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })

  const shown = workout.exercises.slice(0, 5)
  const more = workout.exercises.length - shown.length

  return (
    <article className="wc">
      <Link to={`/entreno/${workout.id}`} className="wc-top">
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
          {records > 0 ? (
            <div>
              <span>Récords</span>
              <b className="wc-records">
                <Icon name="trophy" size={15} /> {records}
              </b>
            </div>
          ) : (
            <div>
              <span>Series</span>
              <b>{workout.sets_count}</b>
            </div>
          )}
        </div>
      </Link>

      <div className="wc-carousel">
        <div
          ref={track}
          className="wc-track"
          onScroll={(e) => {
            const el = e.currentTarget
            setSlide(Math.round(el.scrollLeft / el.clientWidth))
          }}
        >
          {photos.map((src, i) => (
            <button key={src} className="wc-slide wc-photo" onClick={() => setViewer(i)} aria-label={`Ver foto ${i + 1} del entreno`}>
              <img src={src} alt="" loading="lazy" decoding="async" />
            </button>
          ))}

          <button className="wc-slide wc-summary" onClick={open} aria-label="Resumen del entreno">
            <span className="wc-slide-title">Entreno</span>
            {shown.map((e, i) => {
              const ex = findExercise(e.exerciseId)
              return (
                <span key={i} className="wc-ex">
                  <ExerciseThumb exercise={ex} size={40} />
                  <span>
                    <b>{ex?.name ?? 'Ejercicio'}</b>
                    <small>
                      {e.sets.length} {e.sets.length === 1 ? 'serie' : 'series'}
                    </small>
                  </span>
                </span>
              )
            })}
            {more > 0 && (
              <span className="wc-more">
                y {more} ejercicio{more === 1 ? '' : 's'} más
              </span>
            )}
          </button>

          <button className="wc-slide wc-muscles" onClick={open} aria-label="Músculos trabajados">
            <span className="wc-slide-title">Músculos trabajados</span>
            <BodyMap primary={[]} weights={weights} className="wc-body" />
            <span className="wc-chips">
              {muscles.slice(0, 4).map(([m, v]) => (
                <span key={m}>
                  {MUSCLE_LABEL[m]} <b>{Math.round((v / totalMuscle) * 100)}%</b>
                </span>
              ))}
            </span>
          </button>
        </div>
        <div className="wc-dots" role="tablist" aria-label="Páginas">
          {Array.from({ length: slides }, (_, i) => (
            <button key={i} role="tab" aria-selected={slide === i} aria-label={`Página ${i + 1}`} onClick={() => go(i)} />
          ))}
        </div>
      </div>

      <WorkoutSocial workout={workout} />
      {viewer != null && <PhotoViewer urls={photos} start={viewer} onClose={() => setViewer(null)} />}
    </article>
  )
})
