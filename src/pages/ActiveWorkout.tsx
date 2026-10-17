import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../data/context'
import { MUSCLE_LABEL, type ExerciseType } from '../lib/exercises'
import { REST_OPTIONS, SET_TYPE_LABEL, formatRest, repsLabel, type SetType } from '../lib/routines'
import {
  effective,
  fmtClock,
  fmtKg,
  fmtRpe,
  fmtVolume,
  previousSets,
  RPE_VALUES,
  SUPERSET_COLORS,
  supersetIndex,
  supersetLetter,
  workoutVolume,
  type LiveSet,
  type WorkoutSet,
} from '../lib/workouts'
import { PlateCalculator } from '../components/PlateCalculator'
import type { CSSProperties } from 'react'
import { useActiveWorkout } from '../workout/context'
import { keepScreenOn, unlockAudio } from '../workout/feedback'
import { Icon } from '../components/Icon'
import { ExercisePicker } from '../components/ExercisePicker'
import { ExerciseThumb, Sheet, SheetItem } from '../components/ui'
import { SetBadge } from './RoutineEditor'
import { useNow } from '../workout/useNow'
import { notificationsSupported } from '../workout/notify'
import './ActiveWorkout.css'

type Menu =
  | { kind: 'exercise'; ei: number }
  | { kind: 'rest'; ei: number }
  | { kind: 'set'; ei: number; si: number }
  | { kind: 'superset'; ei: number }
  | { kind: 'plates'; ei: number }
  | { kind: 'discard' }
  | null

/** Registrar el entreno en directo (pantalla principal de Hevy). */
export function ActiveWorkout() {
  const navigate = useNavigate()
  const w = useActiveWorkout()
  const { findExercise, workouts, userId } = useData()
  const now = useNow(1000)
  const [menu, setMenu] = useState<Menu>(null)
  const [picker, setPicker] = useState<null | { replace?: number }>(null)
  const a = w.active

  // Pantalla siempre encendida mientras se entrena
  useEffect(() => {
    let release = () => {}
    keepScreenOn().then((r) => (release = r))
    return () => release()
  }, [])

  if (!a) {
    return (
      <div className="aw-empty">
        <p>No hay ningún entreno en curso.</p>
        <button className="btn btn-primary" onClick={() => navigate('/entrenamiento', { replace: true })}>
          Ir a Entrenamiento
        </button>
      </div>
    )
  }

  if (picker) {
    return (
      <ExercisePicker
        single={picker.replace != null}
        onCancel={() => setPicker(null)}
        onDone={(ids) => {
          if (picker.replace != null) w.replaceExercise(picker.replace, ids[0])
          else w.addExercises(ids)
          setPicker(null)
        }}
      />
    )
  }

  const doneSets = a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
  const volume = workoutVolume(
    a.exercises.map((e) => {
      const prev = previousSets(workouts, userId, e.exerciseId)
      return { exerciseId: e.exerciseId, sets: e.sets.map((s, i) => ({ ...s, ...effective(s, prev[i]) })).filter((s) => s.done) }
    }),
    findExercise,
  )
  const current = menu && 'ei' in menu ? a.exercises[menu.ei] : undefined
  const groups = supersetIndex(a.exercises)
  const groupOf = (e: { supersetId?: string | null }) => (e.supersetId != null ? groups.get(e.supersetId) : undefined)
  const currentEx = current ? findExercise(current.exerciseId) : undefined
  // Peso de partida para la calculadora: la última serie con peso
  const plateStart = (() => {
    if (menu?.kind !== 'plates' || !current) return null
    const prev = previousSets(workouts, userId, current.exerciseId)
    for (let i = current.sets.length - 1; i >= 0; i--) {
      const v = current.sets[i].weight ?? prev[i]?.weight ?? current.sets[i].target?.weight
      if (v) return v
    }
    return null
  })()

  return (
    <div className="aw" onPointerDown={unlockAudio}>
      <header className="aw-top">
        <button className="header-btn" aria-label="Minimizar entreno" onClick={() => navigate(-1)}>
          <Icon name="chevronDown" />
        </button>
        <h1>Registrar entreno</h1>
        <button className="save-btn" onClick={() => navigate('/entreno/guardar')}>
          Terminar
        </button>
      </header>

      <div className="aw-stats">
        <div>
          <span>Duración</span>
          <b className="tnum aw-clock">{fmtClock((now - a.startedAt) / 1000)}</b>
        </div>
        <div>
          <span>Volumen</span>
          <b className="tnum">{fmtVolume(volume)}</b>
        </div>
        <div>
          <span>Series</span>
          <b className="tnum">{doneSets}</b>
        </div>
      </div>

      <div className="aw-body">
        <NotifyBanner />
        {a.exercises.length === 0 && (
          <div className="empty">
            <Icon name="dumbbell" size={40} stroke={1.5} />
            <strong>Empieza</strong>
            <p>Añade un ejercicio para empezar a registrar tus series.</p>
          </div>
        )}

        {a.exercises.map((e, ei) => {
          const ex = findExercise(e.exerciseId)
          const type: ExerciseType = ex?.type ?? 'weight_reps'
          const prev = previousSets(workouts, userId, e.exerciseId)
          const g = groupOf(e)
          const nextInGroup = g != null && a.exercises[ei + 1]?.supersetId === e.supersetId
          return (
            <section
              key={e.key}
              className={`aw-ex ${g != null ? 'ss-group' : ''} ${nextInGroup ? 'ss-cont' : ''}`}
              style={g != null ? ({ '--ss': SUPERSET_COLORS[g % SUPERSET_COLORS.length] } as CSSProperties) : undefined}
            >
              {g != null && <span className="ss-label">Superserie {supersetLetter(g)}</span>}
              <div className="re-ex-head">
                <button className="aw-ex-link" onClick={() => navigate(`/ejercicio/${encodeURIComponent(e.exerciseId)}`)}>
                  <ExerciseThumb exercise={ex} />
                  <span className="re-ex-name">
                    <b>{ex?.name ?? 'Ejercicio no disponible'}</b>
                    {ex && <span>{MUSCLE_LABEL[ex.muscle]}</span>}
                  </span>
                </button>
                <button className="header-btn" aria-label="Opciones del ejercicio" onClick={() => setMenu({ kind: 'exercise', ei })}>
                  <Icon name="more" />
                </button>
              </div>

              <textarea
                id={`aw-notes-${e.key}`}
                className="re-notes"
                placeholder="Añadir notas aquí…"
                value={e.notes}
                rows={1}
                maxLength={300}
                onChange={(ev) => w.setNotes(ei, ev.target.value)}
              />
              <button className="re-rest" onClick={() => setMenu({ kind: 'rest', ei })}>
                <Icon name="timer" size={18} />
                Temporizador de descanso: {formatRest(e.restSeconds)}
              </button>

              <SetsTable
                type={type}
                sets={e.sets}
                prev={prev}
                onType={(si) => setMenu({ kind: 'set', ei, si })}
                onChange={(si, patch) => w.updateSet(ei, si, patch)}
                onToggle={(si) => w.toggleDone(ei, si)}
              />

              <button className="btn btn-block re-add-set" onClick={() => w.addSet(ei)}>
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
        <button className="btn btn-block aw-discard" onClick={() => setMenu({ kind: 'discard' })}>
          Descartar entreno
        </button>
      </div>

      <RestBar />

      <Sheet open={menu?.kind === 'exercise'} onClose={() => setMenu(null)} title={current ? findExercise(current.exerciseId)?.name : ''}>
        {menu?.kind === 'exercise' && (
          <>
            <SheetItem icon={<Icon name="swap" size={20} />} onClick={() => (setPicker({ replace: menu.ei }), setMenu(null))}>
              Sustituir ejercicio
            </SheetItem>
            {a.exercises.length > 1 && (
              <SheetItem icon={<Icon name="link" size={20} />} onClick={() => setMenu({ kind: 'superset', ei: menu.ei })}>
                {groupOf(a.exercises[menu.ei]) != null ? 'Añadir otro a la superserie' : 'Hacer superserie con…'}
              </SheetItem>
            )}
            {groupOf(a.exercises[menu.ei]) != null && (
              <SheetItem icon={<Icon name="unlink" size={20} />} onClick={() => (w.setSuperset(menu.ei, null), setMenu(null))}>
                Quitar de la superserie
              </SheetItem>
            )}
            {(currentEx?.equipment === 'barbell' || /smith/i.test(currentEx?.nameEn ?? currentEx?.name ?? '')) && (
              <SheetItem icon={<Icon name="plates" size={20} />} onClick={() => setMenu({ kind: 'plates', ei: menu.ei })}>
                Calculadora de discos
              </SheetItem>
            )}
            {menu.ei > 0 && (
              <SheetItem icon={<Icon name="arrowUp" size={20} />} onClick={() => (w.moveExercise(menu.ei, -1), setMenu(null))}>
                Subir
              </SheetItem>
            )}
            {menu.ei < a.exercises.length - 1 && (
              <SheetItem icon={<Icon name="arrowDown" size={20} />} onClick={() => (w.moveExercise(menu.ei, 1), setMenu(null))}>
                Bajar
              </SheetItem>
            )}
            <SheetItem danger icon={<Icon name="close" size={20} />} onClick={() => (w.removeExercise(menu.ei), setMenu(null))}>
              Quitar ejercicio
            </SheetItem>
          </>
        )}
      </Sheet>

      <Sheet open={menu?.kind === 'superset'} onClose={() => setMenu(null)} title="Superserie con…">
        {menu?.kind === 'superset' && (
          <>
            <p className="aw-sheet-note">Se alternan las series y el descanso empieza al terminar cada ronda.</p>
            {a.exercises.map((e, i) =>
              i === menu.ei || (e.supersetId && e.supersetId === a.exercises[menu.ei].supersetId) ? null : (
                <SheetItem
                  key={e.key}
                  icon={<ExerciseThumb exercise={findExercise(e.exerciseId)} size={36} />}
                  onClick={() => (w.setSuperset(menu.ei, i), setMenu(null))}
                >
                  {findExercise(e.exerciseId)?.name ?? 'Ejercicio'}
                </SheetItem>
              ),
            )}
          </>
        )}
      </Sheet>

      <Sheet open={menu?.kind === 'plates'} onClose={() => setMenu(null)} title="Calculadora de discos">
        {menu?.kind === 'plates' && <PlateCalculator initial={plateStart} />}
      </Sheet>

      <Sheet open={menu?.kind === 'rest'} onClose={() => setMenu(null)} title="Temporizador de descanso">
        {menu?.kind === 'rest' &&
          REST_OPTIONS.map((s) => (
            <SheetItem key={s} selected={current?.restSeconds === s} onClick={() => (w.setRestSeconds(menu.ei, s), setMenu(null))}>
              {formatRest(s)}
            </SheetItem>
          ))}
      </Sheet>

      <Sheet open={menu?.kind === 'set'} onClose={() => setMenu(null)} title="Tipo de serie">
        {menu?.kind === 'set' && (
          <>
            <div className="aw-rpe-pick">
              <span>
                RPE <small>esfuerzo de 6 a 10</small>
              </span>
              <div role="group" aria-label="RPE">
                {RPE_VALUES.map((v) => {
                  const on = current?.sets[menu.si]?.rpe === v
                  return (
                    <button key={v} aria-pressed={on} onClick={() => w.setRpe(menu.ei, menu.si, on ? null : v)}>
                      {fmtRpe(v)}
                    </button>
                  )
                })}
              </div>
            </div>
            {(['warmup', 'normal', 'failure', 'drop'] as SetType[]).map((t) => (
              <SheetItem
                key={t}
                icon={<SetBadge type={t} n={1} />}
                selected={current?.sets[menu.si]?.type === t}
                onClick={() => (w.setSetType(menu.ei, menu.si, t), setMenu(null))}
              >
                {SET_TYPE_LABEL[t]}
              </SheetItem>
            ))}
            <SheetItem danger icon={<Icon name="close" size={20} />} onClick={() => (w.removeSet(menu.ei, menu.si), setMenu(null))}>
              Eliminar serie
            </SheetItem>
          </>
        )}
      </Sheet>

      <Sheet open={menu?.kind === 'discard'} onClose={() => setMenu(null)} title="¿Descartar el entreno?">
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
          <button className="btn btn-block" onClick={() => setMenu(null)}>
            Seguir entrenando
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function SetsTable({
  type,
  sets,
  prev,
  onType,
  onChange,
  onToggle,
}: {
  type: ExerciseType
  sets: LiveSet[]
  prev: WorkoutSet[]
  onType: (si: number) => void
  onChange: (si: number, patch: Partial<Pick<LiveSet, 'weight' | 'reps' | 'duration'>>) => void
  onToggle: (si: number) => void
}) {
  let n = 0
  const showWeight = type === 'weight_reps' || type === 'assisted'
  const prevLabel = (p?: WorkoutSet) => {
    if (!p) return '—'
    if (type === 'duration') return p.duration != null ? fmtClock(p.duration) : '—'
    if (type === 'reps') return `${p.reps ?? 0}`
    return `${type === 'assisted' ? '-' : ''}${fmtKg(p.weight ?? 0)} kg × ${p.reps ?? 0}`
  }
  return (
    <div className={`aw-sets ${showWeight ? '' : 'one'}`}>
      <div className="aw-set head">
        <span>SERIE</span>
        <span>ANTERIOR</span>
        {showWeight && <span>{type === 'assisted' ? '-KG' : 'KG'}</span>}
        <span>{type === 'duration' ? 'TIEMPO' : 'REPS'}</span>
        <span aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
      </div>
      {sets.map((s, si) => {
        if (s.type !== 'warmup') n++
        const p = prev[si]
        const wPh = p?.weight ?? s.target?.weight
        const rPh =
          p?.reps != null
            ? String(p.reps)
            : s.target
              ? repsLabel({ type: s.type, weight: null, duration: null, reps: s.target.reps ?? null, repsMax: s.target.repsMax ?? null })
              : null
        const dPh = p?.duration ?? s.target?.duration
        return (
          <div key={s.key} className={`aw-set ${s.done ? 'done' : ''}`}>
            <button className="re-set-n aw-set-n" onClick={() => onType(si)} aria-label={`Serie ${si + 1}: tipo y RPE`}>
              <SetBadge type={s.type} n={n} />
              {s.rpe ? <small className="aw-rpe tnum">{fmtRpe(s.rpe)}</small> : null}
            </button>
            <span className="aw-prev tnum">{prevLabel(p)}</span>
            {showWeight && (
              <LiveInput
                key={`${s.key}-w-${s.done}`}
                id={`${s.key}-w`}
                value={s.weight}
                placeholder={wPh != null ? fmtKg(wPh) : '-'}
                decimal
                onChange={(v) => onChange(si, { weight: v })}
              />
            )}
            {type === 'duration' ? (
              <LiveInput
                key={`${s.key}-d-${s.done}`}
                id={`${s.key}-d`}
                value={s.duration}
                placeholder={dPh != null ? String(dPh) : 's'}
                onChange={(v) => onChange(si, { duration: v })}
              />
            ) : (
              <LiveInput
                key={`${s.key}-r-${s.done}`}
                id={`${s.key}-r`}
                value={s.reps}
                placeholder={rPh ?? '-'}
                onChange={(v) => onChange(si, { reps: v })}
              />
            )}
            <button
              className={`aw-check ${s.done ? 'on' : ''}`}
              onClick={() => onToggle(si)}
              aria-pressed={s.done}
              aria-label={`Completar serie ${si + 1}`}
            >
              <Icon name="check" size={18} stroke={3} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function LiveInput({
  id,
  value,
  placeholder,
  decimal,
  onChange,
}: {
  id: string
  value: number | null
  placeholder: string
  decimal?: boolean
  onChange: (v: number | null) => void
}) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','))
  return (
    <input
      id={id}
      className="re-input tnum"
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setText(t)
        const v = parseFloat(t.replace(',', '.'))
        onChange(Number.isFinite(v) ? v : null)
      }}
    />
  )
}

/** Barra del descanso: cuenta atrás, −15 / +15 y Saltar */
export function RestBar() {
  const w = useActiveWorkout()
  const now = useNow(250)
  const rest = w.active?.rest
  if (!rest) return null
  const left = Math.max(0, (rest.endsAt - now) / 1000)
  return (
    <div className="restbar" role="timer" aria-live="off">
      <div className="restbar-inner">
        <span className="restbar-prog" style={{ width: `${(left / rest.total) * 100}%` }} />
        <b className="tnum">{fmtClock(Math.ceil(left))}</b>
        <span className="restbar-label">Descanso</span>
        <button onClick={() => w.adjustRest(-15)}>−15</button>
        <button onClick={() => w.adjustRest(15)}>+15</button>
        <button className="restbar-skip" onClick={w.skipRest}>
          Saltar
        </button>
      </div>
    </div>
  )
}

/** Aviso para activar las notificaciones del entreno (descanso y completar serie) */
function NotifyBanner() {
  const [perm, setPerm] = useState(() => (notificationsSupported() ? Notification.permission : 'unsupported'))
  if (perm === 'granted' || perm === 'unsupported') return null
  if (perm === 'denied') {
    return (
      <p className="aw-notify">
        Las notificaciones están bloqueadas. Para controlar el descanso desde fuera de la app, actívalas en Ajustes de Android → Aplicaciones → Heavy
        → Notificaciones.
      </p>
    )
  }
  return (
    <div className="aw-notify">
      <span>Activa las notificaciones para ver el descanso y completar series sin abrir la app.</span>
      <button
        className="btn btn-primary"
        onClick={async () => {
          try {
            setPerm(await Notification.requestPermission())
          } catch {
            /* sin permiso */
          }
        }}
      >
        Activar
      </button>
    </div>
  )
}
