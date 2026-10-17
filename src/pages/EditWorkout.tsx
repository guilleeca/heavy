import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { MUSCLE_LABEL, type ExerciseType } from '../lib/exercises'
import { SET_TYPE_LABEL, type RoutineSet, type SetType } from '../lib/routines'
import { fmtDuration, fmtVolume, isActivity, uid, workoutVolume, type Workout, type WorkoutExercise } from '../lib/workouts'
import { KIND_EMOJI, KIND_LABEL, type ActivityKind } from '../lib/gpx'
import { Icon } from '../components/Icon'
import { ExercisePicker } from '../components/ExercisePicker'
import { ExerciseThumb, PageHeader, Sheet, SheetItem, Spinner } from '../components/ui'
import { WhenFields } from '../components/WhenFields'
import { useCropQueue } from '../components/useCropQueue'
import { clearShared, readShared } from '../lib/shared'
import { SetBadge, SetTable } from './RoutineEditor'
import './RoutineEditor.css'
import './FinishWorkout.css'
import '../components/CustomExerciseForm.css'
import { usePhotoUrls } from '../lib/photos'
import './EditWorkout.css'
import './ImportActivity.css'

type KSet = RoutineSet & { _k: string; rpe?: number | null }
type KItem = { _k: string; exerciseId: string; notes: string; sets: KSet[]; supersetId?: string | null }
const rid = () => Math.random().toString(36).slice(2, 10)
const toItems = (list: WorkoutExercise[]): KItem[] =>
  list.map((e) => ({
    _k: rid(),
    exerciseId: e.exerciseId,
    notes: e.notes ?? '',
    supersetId: e.supersetId ?? null,
    sets: e.sets.map((s) => ({ ...s, repsMax: null, _k: rid() })),
  }))
const fromItems = (list: KItem[]): WorkoutExercise[] =>
  list
    .map((e) => ({
      exerciseId: e.exerciseId,
      notes: e.notes.trim(),
      supersetId: e.supersetId ?? null,
      sets: e.sets.map((s) => ({ type: s.type, weight: s.weight, reps: s.reps, duration: s.duration, ...(s.rpe ? { rpe: s.rpe } : {}) })),
    }))
    .filter((e) => e.sets.length > 0)
    .map((e, _, all) => (e.supersetId && all.filter((x) => x.supersetId === e.supersetId).length < 2 ? { ...e, supersetId: null } : e))
const blankSet = (prev?: KSet): KSet => ({
  type: prev && prev.type !== 'warmup' ? prev.type : 'normal',
  weight: prev?.weight ?? null,
  reps: prev?.reps ?? null,
  repsMax: null,
  duration: prev?.duration ?? null,
  _k: rid(),
})

type Menu = { kind: 'exercise'; index: number } | { kind: 'set'; index: number; set: number } | { kind: 'visibility' } | { kind: 'discard' } | null

/** Editar un entreno ya guardado: todo lo que se puede cambiar en Hevy */
export function EditWorkout() {
  const { id } = useParams()
  const { workouts, userId, ready } = useData()
  const w = workouts.find((x) => x.id === id)
  if (!ready) return <Spinner />
  if (!w || w.user_id !== userId) {
    return (
      <>
        <PageHeader title="Editar entreno" />
        <p className="empty">Este entreno no existe o no es tuyo.</p>
      </>
    )
  }
  return <Editor key={w.id} workout={w} />
}

function Editor({ workout: w }: { workout: Workout }) {
  const navigate = useNavigate()
  const { findExercise, refresh, userId } = useData()
  const [title, setTitle] = useState(w.title)
  const [description, setDescription] = useState(w.description)
  const [visibility, setVisibility] = useState(w.visibility)
  const [when, setWhen] = useState({ startedAt: new Date(w.started_at).getTime(), durationS: w.duration_s })
  const [items, setItems] = useState<KItem[]>(() => toItems(w.exercises))
  const [kept, setKept] = useState<string[]>(w.photos)
  const [added, setAdded] = useState<File[]>([])
  const crop = useCropQueue((f) => setAdded((a) => [...a, f]))

  // Fotos compartidas con Heavy desde otra app (menú Compartir de Android)
  const [params, setParams] = useSearchParams()
  const fromShare = params.get('compartido') === '1'
  useEffect(() => {
    if (!fromShare) return
    ;(async () => {
      const got = await readShared()
      const room = 6 - w.photos.length
      if (got?.images.length) {
        if (room <= 0) toast('Este entreno ya tiene 6 fotos: quita alguna para añadir otras')
        else crop.enqueue(got.images.slice(0, room))
      }
      await clearShared()
      setParams({}, { replace: true })
    })()
    // Solo al llegar
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fromShare])
  const [picker, setPicker] = useState<null | { replace?: number }>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [saving, setSaving] = useState(false)
  const activity = isActivity(w)
  const [kind, setKind] = useState<ActivityKind>((w.kind && w.kind !== 'gym' ? w.kind : 'run') as ActivityKind)
  const previews = useMemo(() => added.map((f) => URL.createObjectURL(f)), [added])
  // Distancia y desnivel a mano (p. ej. para que cuadren con Strava)
  const [distText, setDistText] = useState(w.distance_m != null ? (w.distance_m / 1000).toFixed(2).replace('.', ',') : '')
  const [gainText, setGainText] = useState(w.elevation_gain_m != null ? String(Math.round(w.elevation_gain_m)) : '')
  const distM = Math.round((parseFloat(distText.replace(',', '.')) || 0) * 1000)
  const gainM = Math.round(parseFloat(gainText.replace(',', '.')) || 0)

  // Fotos ya subidas: enlaces firmados para verlas
  const signedList = usePhotoUrls(w.photos)
  const signed: Record<string, string> = Object.fromEntries(w.photos.map((p, i) => [p, signedList[i] ?? '']))

  const exercises = fromItems(items)
  const volume = workoutVolume(exercises, findExercise)
  const sets = exercises.reduce((a, e) => a + e.sets.length, 0)

  const update = (i: number, fn: (e: KItem) => KItem) => setItems((list) => list.map((e, k) => (k === i ? fn(e) : e)))
  const updateSet = (i: number, s: number, patch: Partial<RoutineSet>) =>
    update(i, (e) => ({ ...e, sets: e.sets.map((x, k) => (k === s ? { ...x, ...patch } : x)) }))

  async function save() {
    if (!title.trim()) return toast('Ponle un título al entreno')
    if (!activity && !sets) return toast('El entreno necesita al menos una serie')
    setSaving(true)
    // Fotos nuevas → Storage; las quitadas se borran
    const photos = [...kept]
    for (const f of added) {
      if (photos.length >= 6) break
      const ext = (f.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      const path = `${userId}/${w.id}/${uid()}.${ext}`
      const up = await supabase.storage.from('workout-photos').upload(path, f, { contentType: f.type })
      if (!up.error) photos.push(path)
    }
    const { error } = await supabase
      .from('workouts')
      .update({
        title: title.trim(),
        description: description.trim(),
        visibility,
        started_at: new Date(when.startedAt).toISOString(),
        ended_at: new Date(when.startedAt + when.durationS * 1000).toISOString(),
        duration_s: when.durationS,
        ...(activity
          ? { kind, moving_s: when.durationS === w.duration_s ? w.moving_s : null, distance_m: distM, elevation_gain_m: gainM }
          : { volume_kg: volume, sets_count: sets, exercises }),
        photos,
      })
      .eq('id', w.id)
    if (error) {
      setSaving(false)
      return toast('No se pudo guardar. Revisa la conexión.')
    }
    const removed = w.photos.filter((p) => !kept.includes(p))
    if (removed.length) await supabase.storage.from('workout-photos').remove(removed)
    await refresh()
    setSaving(false)
    toast(activity ? 'Actividad actualizada' : 'Entreno actualizado')
    navigate(`/entreno/${w.id}`, { replace: true })
  }

  if (picker) {
    return (
      <ExercisePicker
        single={picker.replace != null}
        onCancel={() => setPicker(null)}
        onDone={(ids) => {
          if (picker.replace != null) update(picker.replace, (e) => ({ ...e, exerciseId: ids[0] }))
          else setItems((list) => [...list, ...ids.map((x) => ({ _k: rid(), exerciseId: x, notes: '', sets: [blankSet()] }))])
          setPicker(null)
        }}
      />
    )
  }

  const current = menu && 'index' in menu ? items[menu.index] : undefined
  const totalPhotos = kept.length + added.length

  return (
    <div className="ew">
      <PageHeader
        title={activity ? 'Editar actividad' : 'Editar entreno'}
        left={
          <button className="text-btn" onClick={() => setMenu({ kind: 'discard' })}>
            Cancelar
          </button>
        }
        right={
          <button className="save-btn" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        }
      />

      <div className="fw-body">
        <input className="re-title" placeholder="Título del entreno" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        {activity && (
          <div className="ia-kinds" role="radiogroup" aria-label="Tipo de actividad">
            {(['run', 'hike', 'walk', 'ride'] as ActivityKind[]).map((k) => (
              <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>
                <span aria-hidden="true">{KIND_EMOJI[k]}</span> {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        {activity && (
          <>
            <div className="ew-act">
              <label>
                <span>Distancia</span>
                <span className="ew-unit">
                  <input
                    inputMode="decimal"
                    value={distText}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDistText(e.target.value.replace(/[^\d.,]/g, ''))}
                  />
                  km
                </span>
              </label>
              <label>
                <span>Desnivel +</span>
                <span className="ew-unit">
                  <input
                    inputMode="numeric"
                    value={gainText}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setGainText(e.target.value.replace(/[^\d]/g, ''))}
                  />
                  m
                </span>
              </label>
            </div>
            <p className="ew-hint">Calculados con el GPX. Si prefieres los de Strava, escríbelos aquí.</p>
          </>
        )}

        {!activity && (
          <>
            <div className="fw-stats">
              <div>
                <span>Duración</span>
                <b className="tnum">{fmtDuration(when.durationS)}</b>
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
          </>
        )}

        <WhenFields startedAt={when.startedAt} durationS={when.durationS} onChange={setWhen} />

        <section className="fw-photos">
          {kept.map((p) => (
            <div key={p} className="fw-photo">
              {signed[p] ? <img src={signed[p]} alt="" crossOrigin="anonymous" /> : <span className="ew-ph" />}
              <button aria-label="Quitar foto" onClick={() => setKept((k) => k.filter((x) => x !== p))}>
                <Icon name="close" size={16} stroke={2.5} />
              </button>
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={src} className="fw-photo">
              <img src={src} alt="" />
              <button aria-label="Quitar foto" onClick={() => setAdded((a) => a.filter((_, k) => k !== i))}>
                <Icon name="close" size={16} stroke={2.5} />
              </button>
            </div>
          ))}
          {totalPhotos < 6 && (
            <label className="fw-add-photo">
              <Icon name="plus" size={22} />
              <span>Foto</span>
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  crop.enqueue([...(e.target.files ?? [])].slice(0, 6 - kept.length - added.length))
                  e.target.value = ''
                }}
              />
            </label>
          )}
        </section>

        <textarea
          className="fw-desc"
          placeholder="¿Qué tal ha ido? Añade notas sobre tu entreno…"
          value={description}
          maxLength={1000}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button className="cef-field fw-vis" onClick={() => setMenu({ kind: 'visibility' })}>
          <span className="cef-label">Visibilidad</span>
          <span className="cef-value">{visibility === 'everyone' ? 'Todos' : 'Solo yo'}</span>
          <Icon name="chevronRight" size={18} />
        </button>

        {!activity && (
          <>
            <h2 className="section-title ew-section">Ejercicios</h2>
            {items.map((re, i) => {
              const ex = findExercise(re.exerciseId)
              const type: ExerciseType = ex?.type ?? 'weight_reps'
              return (
                <section key={re._k} className="re-ex">
                  <div className="re-ex-head">
                    <ExerciseThumb exercise={ex} />
                    <div className="re-ex-name">
                      <b>{ex?.name ?? 'Ejercicio no disponible'}</b>
                      {ex && <span>{MUSCLE_LABEL[ex.muscle]}</span>}
                    </div>
                    <button className="header-btn" aria-label="Opciones del ejercicio" onClick={() => setMenu({ kind: 'exercise', index: i })}>
                      <Icon name="more" />
                    </button>
                  </div>
                  <textarea
                    className="re-notes"
                    placeholder="Notas del ejercicio"
                    value={re.notes}
                    rows={1}
                    maxLength={300}
                    onChange={(e) => update(i, (x) => ({ ...x, notes: e.target.value }))}
                  />
                  <SetTable
                    type={type}
                    sets={re.sets}
                    onSetMenu={(s) => setMenu({ kind: 'set', index: i, set: s })}
                    onChange={(s, patch) => updateSet(i, s, patch)}
                    idPrefix={`w${i}`}
                  />
                  <button
                    className="btn btn-block re-add-set"
                    onClick={() => update(i, (x) => ({ ...x, sets: [...x.sets, blankSet(x.sets.at(-1))] }))}
                  >
                    <Icon name="plus" size={18} stroke={2.2} />
                    Añadir serie
                  </button>
                </section>
              )
            })}
            <button className="btn btn-primary btn-block re-add" onClick={() => setPicker({})}>
              <Icon name="plus" size={20} stroke={2.2} />
              Añadir ejercicio
            </button>
          </>
        )}
      </div>

      <Sheet open={menu?.kind === 'exercise'} onClose={() => setMenu(null)} title={current ? findExercise(current.exerciseId)?.name : ''}>
        {menu?.kind === 'exercise' && (
          <>
            <SheetItem icon={<Icon name="swap" size={20} />} onClick={() => (setPicker({ replace: menu.index }), setMenu(null))}>
              Sustituir ejercicio
            </SheetItem>
            {menu.index > 0 && (
              <SheetItem
                icon={<Icon name="arrowUp" size={20} />}
                onClick={() => {
                  const i = menu.index
                  setItems((l) => {
                    const c = [...l]
                    ;[c[i - 1], c[i]] = [c[i], c[i - 1]]
                    return c
                  })
                  setMenu(null)
                }}
              >
                Subir
              </SheetItem>
            )}
            {menu.index < items.length - 1 && (
              <SheetItem
                icon={<Icon name="arrowDown" size={20} />}
                onClick={() => {
                  const i = menu.index
                  setItems((l) => {
                    const c = [...l]
                    ;[c[i + 1], c[i]] = [c[i], c[i + 1]]
                    return c
                  })
                  setMenu(null)
                }}
              >
                Bajar
              </SheetItem>
            )}
            <SheetItem
              danger
              icon={<Icon name="close" size={20} />}
              onClick={() => (setItems((l) => l.filter((_, k) => k !== menu.index)), setMenu(null))}
            >
              Quitar ejercicio
            </SheetItem>
          </>
        )}
      </Sheet>

      <Sheet open={menu?.kind === 'set'} onClose={() => setMenu(null)} title="Tipo de serie">
        {menu?.kind === 'set' && (
          <>
            {(['warmup', 'normal', 'failure', 'drop'] as SetType[]).map((t) => (
              <SheetItem
                key={t}
                icon={<SetBadge type={t} n={1} />}
                selected={current?.sets[menu.set]?.type === t}
                onClick={() => (updateSet(menu.index, menu.set, { type: t }), setMenu(null))}
              >
                {SET_TYPE_LABEL[t]}
              </SheetItem>
            ))}
            <SheetItem
              danger
              icon={<Icon name="close" size={20} />}
              onClick={() => (update(menu.index, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== menu.set) })), setMenu(null))}
            >
              Eliminar serie
            </SheetItem>
          </>
        )}
      </Sheet>

      <Sheet open={menu?.kind === 'visibility'} onClose={() => setMenu(null)} title="¿Quién puede verlo?">
        <SheetItem selected={visibility === 'everyone'} onClick={() => (setVisibility('everyone'), setMenu(null))}>
          Todos (tu hermano lo verá en Inicio)
        </SheetItem>
        <SheetItem selected={visibility === 'private'} onClick={() => (setVisibility('private'), setMenu(null))}>
          Solo yo
        </SheetItem>
      </Sheet>

      <Sheet open={menu?.kind === 'discard'} onClose={() => setMenu(null)} title="¿Descartar los cambios?">
        <div className="sheet-confirm">
          <p>El entreno se quedará como estaba.</p>
          <button className="btn btn-danger btn-block" onClick={() => navigate(-1)}>
            Descartar cambios
          </button>
          <button className="btn btn-block" onClick={() => setMenu(null)}>
            Seguir editando
          </button>
        </div>
      </Sheet>
      {crop.element}
    </div>
  )
}
