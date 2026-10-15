import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../data/context'
import { getLoadedLibrary, MUSCLE_LABEL, EQUIPMENT_LABEL, type Exercise } from '../lib/exercises'
import { buildPlan, parseCsv, type ImportPlan } from '../lib/hevyImport'
import { supabase } from '../lib/supabase'
import { uid, workoutVolume, type WorkoutExercise } from '../lib/workouts'
import { ExerciseThumb, PageHeader, Spinner } from '../components/ui'
import { Icon } from '../components/Icon'
import './ImportHevy.css'

type Step = 'pick' | 'review' | 'saving' | 'done'

/** Importar el historial de Hevy desde su CSV de exportación */
export function ImportHevy() {
  const navigate = useNavigate()
  const { exercises, workouts, userId, refresh } = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<'everyone' | 'private'>('everyone')
  const [progress, setProgress] = useState(0)
  const [imported, setImported] = useState(0)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const rows = parseCsv(await file.text())
      const library = getLoadedLibrary() ?? exercises.filter((e) => !e.custom)
      const myCustoms = exercises.filter((e) => e.custom && e.userId === userId)
      const starts = workouts.filter((w) => w.user_id === userId).map((w) => new Date(w.started_at).getTime())
      const p = buildPlan(rows, library, myCustoms, starts)
      setPlan(p)
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function runImport() {
    if (!plan || !plan.workouts.length) return
    setStep('saving')
    setProgress(0)
    try {
      // 1. Ejercicios personalizados nuevos
      const ids = new Map<string, string>()
      const extra: Exercise[] = []
      for (const c of plan.newCustoms) {
        const { data, error } = await supabase
          .from('custom_exercises')
          .insert({ name: c.name, equipment: c.equipment, muscle: c.muscle, secondary_muscles: [], exercise_type: c.type })
          .select('id')
          .single()
        if (error) throw error
        const id = `c:${data.id}`
        ids.set(c.ref, id)
        extra.push({ id, name: c.name, equipment: c.equipment, muscle: c.muscle, secondary: [], type: c.type, custom: true })
      }
      const byId = new Map([...exercises, ...extra].map((e) => [e.id, e]))
      const find = (id: string) => byId.get(id)

      // 2. Entrenos, en tandas
      const rows = plan.workouts.map((w) => {
        const exs: WorkoutExercise[] = w.exercises.map((e) => ({ ...e, exerciseId: ids.get(e.exerciseId) ?? e.exerciseId }))
        return {
          id: uid(),
          routine_id: null,
          title: w.title,
          description: w.description,
          started_at: w.startedAt.toISOString(),
          ended_at: w.endedAt.toISOString(),
          duration_s: Math.round((w.endedAt.getTime() - w.startedAt.getTime()) / 1000),
          volume_kg: workoutVolume(exs, find),
          sets_count: exs.reduce((a, e) => a + e.sets.length, 0),
          exercises: exs,
          photos: [],
          visibility,
        }
      })
      const BATCH = 25
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('workouts').insert(rows.slice(i, i + BATCH))
        if (error) throw error
        setProgress(Math.min(rows.length, i + BATCH))
      }
      setImported(rows.length)
      await refresh()
      setStep('done')
    } catch {
      setError('Se cortó la importación. Vuelve a subir el archivo: lo que ya entró no se duplica.')
      await refresh()
      setStep('pick')
    }
  }

  const total = plan?.workouts.length ?? 0

  return (
    <div className="ih">
      <PageHeader title="Importar de Hevy" />
      <div className="ih-body">
        {step === 'pick' && (
          <>
            <section className="card ih-steps">
              <h2>Cómo sacar tus datos de Hevy</h2>
              <ol>
                <li>En Hevy, ve a <b>Perfil → Ajustes</b>.</li>
                <li>Entra en <b>Exportar e importar datos</b>.</li>
                <li>Pulsa <b>Exportar entrenamientos</b> y guarda el archivo CSV.</li>
                <li>Súbelo aquí abajo.</li>
              </ol>
              <p className="ih-note">Si lo importas otra vez no se duplica nada: los entrenos que ya están se saltan.</p>
            </section>
            {error && <p className="ih-error">{error}</p>}
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <button className="btn btn-primary btn-block" onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size={18} /> Elegir archivo CSV
            </button>
          </>
        )}

        {step === 'review' && plan && (
          <>
            <section className="ih-summary">
              <div>
                <b>{total}</b>
                <span>entrenos nuevos</span>
              </div>
              <div>
                <b>{plan.duplicates}</b>
                <span>ya importados</span>
              </div>
              <div>
                <b>{plan.matches.length}</b>
                <span>ejercicios</span>
              </div>
            </section>
            {total > 0 && (
              <p className="ih-note">
                Del {plan.workouts[0].startedAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} al{' '}
                {plan.workouts[total - 1].startedAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>
            )}

            <section className="stack">
              <h2 className="section-title">Visibilidad</h2>
              <div className="ih-toggle" role="radiogroup">
                <button role="radio" aria-checked={visibility === 'everyone'} className={visibility === 'everyone' ? 'on' : ''} onClick={() => setVisibility('everyone')}>
                  Todos
                </button>
                <button role="radio" aria-checked={visibility === 'private'} className={visibility === 'private' ? 'on' : ''} onClick={() => setVisibility('private')}>
                  Solo yo
                </button>
              </div>
            </section>

            <section className="stack">
              <h2 className="section-title">Ejercicios</h2>
              <p className="ih-note">
                {plan.newCustoms.length
                  ? `${plan.matches.length - plan.newCustoms.length} se asocian a la biblioteca y ${plan.newCustoms.length} se crearán como ejercicios personalizados.`
                  : 'Todos se asocian a ejercicios que ya existen.'}
              </p>
              <ul className="ih-list">
                {plan.matches.map((m) => (
                  <li key={m.hevyName}>
                    <ExerciseThumb exercise={m.target.kind === 'new' ? undefined : m.target.exercise} size={40} />
                    <div className="ih-ex">
                      <span className="ih-from">{m.hevyName}</span>
                      {m.target.kind === 'new' ? (
                        <span className="ih-to new">
                          Nuevo personalizado · {MUSCLE_LABEL[m.target.custom.muscle]} · {EQUIPMENT_LABEL[m.target.custom.equipment]}
                        </span>
                      ) : (
                        <span className="ih-to">→ {m.target.exercise.name}</span>
                      )}
                    </div>
                    <span className="ih-count tnum">{m.sets}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="ih-actions">
              <button className="btn btn-block" onClick={() => (setPlan(null), setStep('pick'))}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-block" disabled={!total} onClick={runImport}>
                {total ? `Importar ${total} entrenos` : 'Nada nuevo que importar'}
              </button>
            </div>
          </>
        )}

        {step === 'saving' && (
          <section className="ih-center">
            <Spinner />
            <p>
              Importando… <span className="tnum">{progress}</span> de {total}
            </p>
            <div className="ih-bar">
              <span style={{ width: `${total ? (progress / total) * 100 : 0}%` }} />
            </div>
          </section>
        )}

        {step === 'done' && (
          <section className="ih-center">
            <Icon name="trophy" size={44} />
            <h2>¡Historial importado!</h2>
            <p>{imported} entrenos de Hevy ya están en Heavy.</p>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/perfil', { replace: true })}>
              Ver mi perfil
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
