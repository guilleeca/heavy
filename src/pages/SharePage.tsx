import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../data/context'
import { clearShared, readShared, type Shared } from '../lib/shared'
import { stravaGpxLink } from '../lib/gpx'
import { fmtWhen, isActivity } from '../lib/workouts'
import { Icon, KindIcon } from '../components/Icon'
import { PageHeader, Spinner } from '../components/ui'
import './SharePage.css'

/** Fotos (y enlaces) compartidos con Heavy desde otra app: ¿a qué entreno o actividad van? */
export function SharePage() {
  const navigate = useNavigate()
  const { workouts, userId } = useData()
  const [shared, setShared] = useState<Shared | null | undefined>(undefined)

  useEffect(() => {
    readShared().then(setShared)
  }, [])

  const previews = useMemo(() => (shared?.images ?? []).map((f) => URL.createObjectURL(f)), [shared])
  const mine = workouts.filter((w) => w.user_id === userId).slice(0, 15)
  const strava = shared ? stravaGpxLink(shared.text) : null

  if (shared === undefined) return <Spinner />
  if (!shared || (!shared.images.length && !shared.routes.length)) {
    return (
      <>
        <PageHeader title="Compartido con Heavy" />
        <p className="empty">No ha llegado nada que Heavy pueda usar. Prueba a compartirlo otra vez.</p>
      </>
    )
  }

  return (
    <div className="sp">
      <PageHeader
        title="Compartido con Heavy"
        left={
          <button className="text-btn" onClick={() => clearShared().then(() => navigate('/', { replace: true }))}>
            Cancelar
          </button>
        }
      />
      <div className="sp-body">
        <div className="sp-photos">
          {previews.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
        <p className="sp-note">
          {shared.images.length === 1 ? '1 foto' : `${shared.images.length} fotos`}. Elige dónde añadirla{shared.images.length === 1 ? '' : 's'};
          podrás encuadrarlas antes.
        </p>

        <button className="btn btn-primary btn-block" onClick={() => navigate('/actividad/nueva?compartido=1', { replace: true })}>
          <Icon name="route" size={20} />
          {strava ? 'Nueva actividad desde el enlace de Strava' : 'Nueva actividad (GPX)'}
        </button>

        {mine.length > 0 && (
          <section className="stack">
            <h2 className="section-title">Añadir a un entreno o actividad</h2>
            <div className="sp-list">
              {mine.map((w) => (
                <button key={w.id} className="sp-item" onClick={() => navigate(`/entreno/${w.id}/editar?compartido=1`, { replace: true })}>
                  <span className="sp-emoji" aria-hidden="true">
                    <KindIcon kind={isActivity(w) ? w.kind : 'gym'} />
                  </span>
                  <span className="sp-text">
                    <b>{w.title}</b>
                    <small>
                      {fmtWhen(w.started_at)} · {w.photos.length}/6 fotos
                    </small>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
