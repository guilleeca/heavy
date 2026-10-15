import { toast } from '../lib/toast'
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import { MUSCLE_LABEL, type Exercise, type ExerciseType } from '../lib/exercises'
import {
  REST_OPTIONS,
  SET_TYPE_LABEL,
  formatRest,
  newRoutineExercise,
  newSet,
  type RoutineExercise,
  type RoutineSet,
  type SetType,
} from '../lib/routines'
import { Icon } from '../components/Icon'
import { ExercisePicker } from '../components/ExercisePicker'
import { ExerciseThumb, PageHeader, Sheet, SheetItem, Spinner} from '../components/ui'
import './RoutineEditor.css'

// Claves estables para que React no mezcle inputs al reordenar o borrar
type KSet = RoutineSet & { _k: string }
type KItem = Omit<RoutineExercise, 'sets'> & { _k: string; sets: KSet[] }
const rid = () => Math.random().toString(36).slice(2, 10)
const withKeys = (list: RoutineExercise[]): KItem[] =>
  list.map((e) => ({ ...structuredClone(e), _k: rid(), sets: e.sets.map((s) => ({ ...s, _k: rid() })) }))
const stripKeys = (list: KItem[]): RoutineExercise[] =>
  list.map(({ _k: _a, sets, ...e }) => ({ ...e, sets: sets.map(({ _k: _b, ...s }) => s) }))
const keyedSet = (prev?: RoutineSet): KSet => ({ ...newSet(prev), _k: rid() })

type Menu =
  | { kind: 'exercise'; index: number }
  | { kind: 'rest'; index: number }
  | { kind: 'set'; index: number; set: number }
  | { kind: 'discard' }
  | null

/** Crear o editar una rutina (pantalla "Crear rutina" de Hevy). */
export function RoutineEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { routines, findExercise, refresh, ready, userId } = useData()
  const existing = id ? routines.find((r) => r.id === id) : undefined

  if (id && !ready) return <Spinner />
  if (id && (!existing || existing.user_id !== userId)) {
    return (
      <>
        <PageHeader title="Editar rutina" />
        <p className="empty">Esta rutina no existe o no es tuya.</p>
      </>
    )
  }
  return (
    <Editor
      key={existing?.id ?? 'new'}
      initialTitle={existing?.title ?? ''}
      initialExercises={existing?.exercises ?? []}
      routineId={existing?.id}
      folderId={existing ? existing.folder_id : params.get('carpeta')}
      nextPosition={Math.max(0, ...routines.filter((r) => r.user_id === userId).map((r) => r.position + 1))}
      findExercise={findExercise}
      onSaved={async (rid) => {
        await refresh()
        navigate(`/rutina/${rid}`, { replace: true })
      }}
      onExit={() => navigate(-1)}
    />
  )
}

function Editor({
  initialTitle,
  initialExercises,
  routineId,
  folderId,
  nextPosition,
  findExercise,
  onSaved,
  onExit,
}: {
  initialTitle: string
  initialExercises: RoutineExercise[]
  routineId?: string
  folderId: string | null
  nextPosition: number
  findExercise: (id: string) => Exercise | undefined
  onSaved: (id: string) => void
  onExit: () => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const [items, setItems] = useState<KItem[]>(() => withKeys(initialExercises))
  const [picker, setPicker] = useState<null | { replace?: number }>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [saving, setSaving] = useState(false)

  const dirty = useMemo(
    () => title !== initialTitle || JSON.stringify(stripKeys(items)) !== JSON.stringify(initialExercises),
    [title, items, initialTitle, initialExercises],
  )

  const update = (i: number, fn: (e: KItem) => KItem) =>
    setItems((list) => list.map((e, k) => (k === i ? fn(e) : e)))
  const updateSet = (i: number, s: number, patch: Partial<RoutineSet>) =>
    update(i, (e) => ({ ...e, sets: e.sets.map((x, k) => (k === s ? { ...x, ...patch } : x)) }))

  async function save() {
    if (!title.trim()) {
      toast('Ponle un título a la rutina')
      document.getElementById('routine-title')?.focus()
      return
    }
    if (!items.length) {
      toast('Añade al menos un ejercicio')
      return
    }
    setSaving(true)
    const payload = { title: title.trim(), exercises: stripKeys(items) }
    const res = routineId
      ? await supabase.from('routines').update(payload).eq('id', routineId).select('id').single()
      : await supabase
          .from('routines')
          .insert({ ...payload, folder_id: folderId, position: nextPosition })
          .select('id')
          .single()
    setSaving(false)
    if (res.error || !res.data) {
      toast('No se pudo guardar la rutina. Revisa la conexión.')
      return
    }
    toast(routineId ? 'Rutina actualizada' : 'Rutina creada')
    onSaved(res.data.id)
  }

  if (picker) {
    return (
      <ExercisePicker
        single={picker.replace != null}
        onCancel={() => setPicker(null)}
        onDone={(ids) => {
          if (picker.replace != null) {
            update(picker.replace, (e) => ({ ...e, exerciseId: ids[0] }))
          } else {
            setItems((list) => [...list, ...withKeys(ids.map((x) => newRoutineExercise(x)))])
          }
          setPicker(null)
        }}
      />
    )
  }

  const current = menu && 'index' in menu ? items[menu.index] : undefined

  return (
    <div className="re">
      <PageHeader
        title={routineId ? 'Editar rutina' : 'Crear rutina'}
        left={
          <button className="text-btn" onClick={() => (dirty ? setMenu({ kind: 'discard' }) : onExit())}>
            Cancelar
          </button>
        }
        right={
          <button className="save-btn" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : routineId ? 'Actualizar' : 'Guardar'}
          </button>
        }
      />

      <div className="re-body">
        <input
          id="routine-title"
          className="re-title"
          placeholder="Título de la rutina"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />

        {items.length === 0 && (
          <div className="empty">
            <Icon name="dumbbell" size={40} stroke={1.5} />
            <p>Empieza añadiendo un ejercicio a tu rutina</p>
          </div>
        )}

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
                id={`notes-${i}`}
                className="re-notes"
                placeholder="Añadir notas aquí (p. ej. peso por mancuerna)"
                value={re.notes}
                rows={1}
                maxLength={300}
                onChange={(e) => update(i, (x) => ({ ...x, notes: e.target.value }))}
              />

              <button className="re-rest" onClick={() => setMenu({ kind: 'rest', index: i })}>
                <Icon name="timer" size={18} />
                Temporizador de descanso: {formatRest(re.restSeconds)}
              </button>

              <SetTable
                type={type}
                sets={re.sets}
                onSetMenu={(s) => setMenu({ kind: 'set', index: i, set: s })}
                onChange={(s, patch) => updateSet(i, s, patch)}
                idPrefix={`r${i}`}
              />

              <button className="btn btn-block re-add-set" onClick={() => update(i, (x) => ({ ...x, sets: [...x.sets, keyedSet(x.sets.at(-1))] }))}>
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
      </div>

      {/* Menú del ejercicio */}
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

      {/* Descanso */}
      <Sheet open={menu?.kind === 'rest'} onClose={() => setMenu(null)} title="Temporizador de descanso">
        {menu?.kind === 'rest' &&
          REST_OPTIONS.map((s) => (
            <SheetItem key={s} selected={current?.restSeconds === s} onClick={() => (update(menu.index, (x) => ({ ...x, restSeconds: s })), setMenu(null))}>
              {formatRest(s)}
            </SheetItem>
          ))}
      </Sheet>

      {/* Tipo de serie */}
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
            {current && current.sets.length > 1 && (
              <SheetItem
                danger
                icon={<Icon name="close" size={20} />}
                onClick={() => (update(menu.index, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== menu.set) })), setMenu(null))}
              >
                Eliminar serie
              </SheetItem>
            )}
          </>
        )}
      </Sheet>

      {/* Descartar cambios */}
      <Sheet open={menu?.kind === 'discard'} onClose={() => setMenu(null)} title="¿Descartar los cambios?">
        <div className="sheet-confirm">
          <p>Perderás lo que has cambiado en esta rutina.</p>
          <button className="btn btn-danger btn-block" onClick={onExit}>
            Descartar cambios
          </button>
          <button className="btn btn-block" onClick={() => setMenu(null)}>
            Seguir editando
          </button>
        </div>
      </Sheet>
    </div>
  )
}

/** Número de serie con su tipo: W calentamiento, F fallo, D drop set */
export function SetBadge({ type, n }: { type: SetType; n: number }) {
  const label = type === 'warmup' ? 'W' : type === 'failure' ? 'F' : type === 'drop' ? 'D' : String(n)
  return <span className={`set-badge ${type}`}>{label}</span>
}

export function SetTable({
  type,
  sets,
  onChange,
  onSetMenu,
  idPrefix,
}: {
  type: ExerciseType
  sets: (RoutineSet & { _k: string })[]
  onChange: (i: number, patch: Partial<RoutineSet>) => void
  onSetMenu: (i: number) => void
  idPrefix: string
}) {
  let n = 0
  const weightLabel = type === 'assisted' ? '-KG' : 'KG'
  const showWeight = type === 'weight_reps' || type === 'assisted'
  return (
    <div className={`re-sets ${type === 'duration' || type === 'reps' ? 'one' : ''}`}>
      <div className="re-set head">
        <span>SERIE</span>
        {showWeight && <span>{weightLabel}</span>}
        {type === 'duration' ? <span>TIEMPO</span> : <span>REPS</span>}
      </div>
      {sets.map((s, i) => {
        if (s.type !== 'warmup') n++
        return (
          <div key={s._k} className="re-set">
            <button className="re-set-n" onClick={() => onSetMenu(i)} aria-label={`Serie ${i + 1}: cambiar tipo`}>
              <SetBadge type={s.type} n={n} />
            </button>
            {showWeight && (
              <NumInput id={`${idPrefix}-w${i}`} value={s.weight} placeholder="-" onChange={(v) => onChange(i, { weight: v })} decimal />
            )}
            {type === 'duration' ? (
              <DurationInput id={`${idPrefix}-d${i}`} value={s.duration} onChange={(v) => onChange(i, { duration: v })} />
            ) : (
              <RepsInput id={`${idPrefix}-r${i}`} set={s} onChange={(patch) => onChange(i, patch)} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function NumInput({
  id,
  value,
  onChange,
  placeholder,
  decimal,
}: {
  id: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  decimal?: boolean
}) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','))
  return (
    <input
      id={id}
      className="re-input tnum"
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setText(t)
        const v = parseFloat(t.replace(',', '.'))
        onChange(Number.isFinite(v) ? v : null)
      }}
    />
  )
}

/** Acepta "10" o un rango "8-12" */
function RepsInput({ id, set, onChange }: { id: string; set: RoutineSet; onChange: (p: Partial<RoutineSet>) => void }) {
  const initial = set.reps == null ? '' : set.repsMax != null && set.repsMax !== set.reps ? `${set.reps}-${set.repsMax}` : String(set.reps)
  const [text, setText] = useState(initial)
  return (
    <input
      id={id}
      className="re-input tnum"
      inputMode="text"
      placeholder="-"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d-]/g, '')
        setText(t)
        const m = t.match(/^(\d+)(?:-(\d+))?$/)
        if (!m) return onChange({ reps: null, repsMax: null })
        const a = +m[1]
        const b = m[2] ? +m[2] : null
        onChange({ reps: a, repsMax: b != null && b > a ? b : null })
      }}
    />
  )
}

/** Duración "1:30" o "90" (segundos) */
function DurationInput({ id, value, onChange }: { id: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`)
  return (
    <input
      id={id}
      className="re-input tnum"
      inputMode="numeric"
      placeholder="-"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d:]/g, '')
        setText(t)
        const m = t.match(/^(\d+)(?::(\d{1,2}))?$/)
        if (!m) return onChange(null)
        onChange(m[2] != null ? +m[1] * 60 + +m[2] : +m[1])
      }}
    />
  )
}
