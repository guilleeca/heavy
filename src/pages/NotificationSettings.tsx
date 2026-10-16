import { useEffect, useState } from 'react'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { DEFAULT_PREFS, disablePush, enablePush, pushEnabledHere, pushSupported, type NotifyPrefs } from '../lib/push'
import { PageHeader, Spinner } from '../components/ui'
import './NotificationSettings.css'

const OPTIONS: { key: keyof NotifyPrefs; label: string; hint: string }[] = [
  { key: 'live', label: 'Empieza a entrenar', hint: 'Para verle en directo' },
  { key: 'workouts', label: 'Termina un entreno o sube una actividad', hint: 'Gimnasio, carreras y rutas' },
  { key: 'likes', label: 'Le gusta algo tuyo', hint: 'Me gusta en tus entrenos' },
  { key: 'comments', label: 'Comenta', hint: 'En tus entrenos o donde hayas comentado' },
]

/** Ajustes de notificaciones: activarlas en este móvil y elegir qué avisos llegan */
export function NotificationSettings() {
  const { userId } = useData()
  const [here, setHere] = useState<boolean | null>(null)
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    pushEnabledHere().then(setHere)
    supabase
      .from('profiles')
      .select('notify')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => setPrefs(error ? DEFAULT_PREFS : { ...DEFAULT_PREFS, ...(data?.notify ?? {}) }))
  }, [userId])

  async function toggleHere() {
    setBusy(true)
    if (here) {
      await disablePush()
      setHere(false)
    } else {
      const error = await enablePush()
      if (error) toast(error)
      setHere(await pushEnabledHere())
    }
    setBusy(false)
  }

  async function setPref(key: keyof NotifyPrefs, value: boolean) {
    if (!prefs) return
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    const { error } = await supabase.from('profiles').update({ notify: next }).eq('id', userId)
    if (error) {
      setPrefs(prefs)
      toast('No se pudo guardar (¿falta ejecutar 010_notificaciones.sql?)')
    }
  }

  return (
    <div className="ns">
      <PageHeader title="Notificaciones" />
      <div className="ns-body">
        <section className="card ns-device">
          <div>
            <b>En este móvil</b>
            <span>
              {!pushSupported()
                ? 'Este navegador no admite notificaciones'
                : here == null
                  ? 'Comprobando…'
                  : here
                    ? 'Activadas: te llegarán aunque Heavy esté cerrada'
                    : 'Desactivadas'}
            </span>
          </div>
          {pushSupported() && here != null && (
            <button className={`btn ${here ? '' : 'btn-primary'}`} disabled={busy} onClick={toggleHere}>
              {here ? 'Desactivar' : 'Activar'}
            </button>
          )}
        </section>

        <section className="stack">
          <h2 className="section-title">Avisarme cuando tu hermano…</h2>
          {prefs == null ? (
            <Spinner />
          ) : (
            <div className="ns-list">
              {OPTIONS.map((o) => (
                <label key={o.key} className="ns-row">
                  <span>
                    <b>{o.label}</b>
                    <small>{o.hint}</small>
                  </span>
                  <input type="checkbox" role="switch" checked={prefs[o.key]} onChange={(e) => setPref(o.key, e.target.checked)} />
                </label>
              ))}
            </div>
          )}
          <p className="ns-note">Estas preferencias valen para todos tus móviles.</p>
        </section>
      </div>
    </div>
  )
}
