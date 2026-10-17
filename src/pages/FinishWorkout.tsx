import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../data/context'
import { effective, fmtDuration, fmtVolume, previousSets, workoutVolume } from '../lib/workouts'
import { useActiveWorkout } from '../workout/context'
import { useNow } from '../workout/useNow'
import { Icon } from '../components/Icon'
import { PageHeader, Sheet, SheetItem } from '../components/ui'
import { toast } from '../lib/toast'
import { supabase } from '../lib/supabase'
import { routineChanges, routineFromWorkout } from '../lib/routines'
import { WhenFields } from '../components/WhenFields'
import { useCropQueue } from '../components/useCropQueue'
import './FinishWorkout.css'
import './RoutineEditor.css'
import './ActiveWorkout.css'
import '../components/CustomExerciseForm.css'

/** Guardar entreno: título, fotos, descripción y visibilidad. */
export function FinishWorkout() {
  const navigate = useNavigate()
  const w = useActiveWorkout()
  const { findExercise, workouts, userId, routines } = useData()
  const now = useNow(1000)
  const a = w.active
  const [title, setTitle] = useState(a?.title ?? '')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'everyone' | 'private'>('everyone')
  const [photos, setPhotos] = useState<File[]>([])
  const crop = useCropQueue((f) => setPhotos((p) => [...p, f].slice(0, 6)))
  const [sheet, setSheet] = useState<'visibility' | 'discard' | null>(null)
  const [saving, setSaving] = useState(false)
  // Hora y duración corregidas a mano (null = las reales)
  const [when, setWhen] = useState<{ startedAt: number; durationS: number } | null>(null)
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos])
  // ¿Actualizar la rutina con lo que se ha hecho? (solo si ha cambiado)
  const [updateRoutine, setUpdateRoutine] = useState(false)

  if (!a) {
    return (
      <>
        <PageHeader title="Guardar entreno" />
        <p className="empty">No hay ningún entreno en curso.</p>
      </>
    )
  }

  const done = a.exercises.map((e) => {
    const prev = previousSets(workouts, userId, e.exerciseId)
    return { exerciseId: e.exerciseId, sets: e.sets.map((s, i) => ({ ...s, ...effective(s, prev[i]) })).filter((s) => s.done) }
  })
  const sets = done.reduce((n, e) => n + e.sets.length, 0)
  const volume = workoutVolume(done, findExercise)

  const routine = a.routineId ? routines.find((r) => r.id === a.routineId && r.user_id === userId) : undefined
  const changes = routine ? routineChanges(routine, a.exercises) : []

  async function save() {
    if (!sets) return
    setSaving(true)
    if (routine && changes.length && updateRoutine) {
      const { error } = await supabase
        .from('routines')
        .update({ exercises: routineFromWorkout(routine, a!.exercises) })
        .eq('id', routine.id)
      if (error) toast('No se pudo actualizar la rutina; el entreno sí se guarda')
    }
    const id = await w.finish({ title, description, visibility, photos, ...(when ?? {}) })
    setSaving(false)
    if (!id) return toast('No se pudo guardar el entreno. Revisa la conexión e inténtalo de nuevo.')
    navigate(`/entreno/${id}?nuevo=1`, { replace: true })
  }

  return (
    <div className="fw">
      <PageHeader
        title="Guardar entreno"
        right={
          <button className="save-btn" disabled={!sets || saving} onClick={save}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        }
      />
      <div className="fw-body">
        <input
          id="workout-title"
          className="re-title"
          placeholder="Título del entreno"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="fw-stats">
          <div>
            <span>Duración</span>
            <b className="tnum">{fmtDuration(when ? when.durationS : (now - a.startedAt) / 1000)}</b>
          </div>
          <div>
            <span>Volumen</span>
            <b className="tnum">{fmtVolume(volume)}</b>
          </div>
          <div>
            <span>Series</span>
            <b className="tnum">{sets}</b>
          </div>
        </div>
        {when ? (
          <WhenFields startedAt={when.startedAt} durationS={when.durationS} onChange={setWhen} />
        ) : (
          <p className="fw-when">
            Empezado el {new Date(a.startedAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las{' '}
            {new Date(a.startedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} ·{' '}
            <button
              className="fw-edit-when"
              onClick={() => setWhen({ startedAt: a.startedAt, durationS: Math.round((now - a.startedAt) / 60000) * 60 })}
            >
              Editar hora y duración
            </button>
          </p>
        )}

        {routine && changes.length > 0 && sets > 0 && (
          <section className="card fw-routine">
            <div>
              <b>Has cambiado la rutina «{routine.title}»</b>
              <span>{changes.join(' · ')}</span>
            </div>
            <div className="fw-routine-opts" role="radiogroup" aria-label="Rutina">
              <button role="radio" aria-checked={!updateRoutine} onClick={() => setUpdateRoutine(false)}>
                Dejarla como estaba
              </button>
              <button role="radio" aria-checked={updateRoutine} onClick={() => setUpdateRoutine(true)}>
                Actualizar rutina
              </button>
            </div>
          </section>
        )}

        {!sets && <p className="fw-warn">Marca con ✓ al menos una serie para poder guardar el entreno.</p>}

        <section className="fw-photos">
          {previews.map((src, i) => (
            <div key={src} className="fw-photo">
              <img src={src} alt={`Foto ${i + 1}`} />
              <button aria-label="Quitar foto" onClick={() => setPhotos((p) => p.filter((_, k) => k !== i))}>
                <Icon name="close" size={16} stroke={2.5} />
              </button>
            </div>
          ))}
          {photos.length < 6 && (
            <label className="fw-add-photo">
              <Icon name="plus" size={22} />
              <span>Foto</span>
              <input
                id="workout-photos"
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  crop.enqueue([...(e.target.files ?? [])].slice(0, 6 - photos.length))
                  e.target.value = ''
                }}
              />
            </label>
          )}
        </section>

        <textarea
          id="workout-description"
          className="fw-desc"
          placeholder="¿Qué tal ha ido? Añade notas sobre tu entreno…"
          value={description}
          maxLength={1000}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button className="cef-field fw-vis" onClick={() => setSheet('visibility')}>
          <span className="cef-label">Visibilidad</span>
          <span className="cef-value">{visibility === 'everyone' ? 'Todos' : 'Solo yo'}</span>
          <Icon name="chevronRight" size={18} />
        </button>

        <button className="btn btn-block aw-discard" onClick={() => setSheet('discard')}>
          Descartar entreno
        </button>
      </div>

      <Sheet open={sheet === 'visibility'} onClose={() => setSheet(null)} title="¿Quién puede verlo?">
        <SheetItem selected={visibility === 'everyone'} onClick={() => (setVisibility('everyone'), setSheet(null))}>
          Todos (tu hermano lo verá en Inicio)
        </SheetItem>
        <SheetItem selected={visibility === 'private'} onClick={() => (setVisibility('private'), setSheet(null))}>
          Solo yo
        </SheetItem>
      </Sheet>

      <Sheet open={sheet === 'discard'} onClose={() => setSheet(null)} title="¿Descartar el entreno?">
        <div className="sheet-confirm">
          <p>Se perderán todas las series de este entreno.</p>
          <button
            className="btn btn-danger btn-block"
            onClick={async () => {
              await w.discard()
              navigate('/entrenamiento', { replace: true })
            }}
          >
            Descartar entreno
          </button>
          <button className="btn btn-block" onClick={() => setSheet(null)}>
            Cancelar
          </button>
        </div>
      </Sheet>
      {crop.element}
    </div>
  )
}
