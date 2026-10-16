import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useData } from '../data/context'
import { useRoutes } from '../data/useRoutes'
import { estimateSeconds, fmtKm, KIND_EMOJI } from '../lib/gpx'
import { fmtDuration } from '../lib/workouts'
import { Icon } from '../components/Icon'
import { PageHeader, Spinner } from '../components/ui'
import { StaticMap } from '../components/StaticMap'
import './Routes.css'

/** Biblioteca de rutas para seguir con el GPS */
export function Routes() {
  const navigate = useNavigate()
  const { userId, profiles } = useData()
  const { routes, error } = useRoutes()
  const [tab, setTab] = useState<'mine' | 'others'>('mine')
  const list = (routes ?? []).filter((r) => (tab === 'mine' ? r.user_id === userId : r.user_id !== userId))

  return (
    <div className="rt">
      <PageHeader
        title="Rutas"
        right={
          <button className="header-btn" aria-label="Importar ruta" onClick={() => navigate('/actividad/nueva?modo=ruta')}>
            <Icon name="plus" />
          </button>
        }
      />
      <div className="rt-body">
        <div className="rt-actions one">
          <Link className="btn btn-primary" to="/actividad/nueva?modo=ruta">
            <Icon name="plus" size={18} stroke={2.2} />
            Importar ruta
          </Link>
        </div>

        <div className="rt-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>
            Mis rutas
          </button>
          <button role="tab" aria-selected={tab === 'others'} onClick={() => setTab('others')}>
            De mi hermano
          </button>
        </div>

        {error && <p className="ih-error">{error}</p>}
        {routes == null ? (
          <Spinner />
        ) : !list.length ? (
          <div className="empty">
            <Icon name="route" size={40} stroke={1.4} />
            <p>
              {tab === 'mine'
                ? 'Importa una ruta de Wikiloc, Komoot o Strava (GPX) para seguirla con el GPS.'
                : 'Cuando tu hermano guarde rutas, aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="rt-list">
            {list.map((r) => {
              const author = profiles.find((p) => p.id === r.user_id)
              return (
                <Link key={r.id} to={`/ruta/${r.id}`} className="rt-card">
                  <StaticMap track={r.track} className="rt-map" />
                  <div className="rt-info">
                    <b>
                      {KIND_EMOJI[r.kind]} {r.title}
                    </b>
                    <span className="tnum">
                      {fmtKm(r.distance_m)} · +{Math.round(r.elevation_gain_m)} m ·{' '}
                      {fmtDuration(estimateSeconds(r.kind, r.distance_m, r.elevation_gain_m))}
                    </span>
                    {tab === 'others' && <small>de {author?.full_name?.split(' ')[0] ?? 'tu hermano'}</small>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
