import { lazy, Suspense, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useData } from '../data/context'
import { useRoutes } from '../data/useRoutes'
import { estimateSeconds, fmtKm, KIND_LABEL, trackToGpx } from '../lib/gpx'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { fmtDuration } from '../lib/workouts'
import { Icon } from '../components/Icon'
import { PageHeader, Sheet, SheetItem, Spinner } from '../components/ui'
import { StaticMap } from '../components/StaticMap'
import { ElevationProfile } from '../components/ActivityView'
import { Avatar } from './RoutineDetail'
import '../components/ActivityView.css'
import './WorkoutDetail.css'
import './Routes.css'
import './RouteDetail.css'

const RouteMap = lazy(() => import('../components/RouteMap'))

/** Ficha de una ruta guardada: mapa, cifras, perfil y "Seguir ruta" */
export function RouteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userId, profiles } = useData()
  const { routes } = useRoutes()
  const [sel, setSel] = useState<number | null>(null)
  const [menu, setMenu] = useState<null | 'main' | 'delete'>(null)
  const r = routes?.find((x) => x.id === id)

  if (routes == null) return <Spinner />
  if (!r) {
    return (
      <>
        <PageHeader title="Ruta" />
        <p className="empty">Esta ruta no existe.</p>
      </>
    )
  }
  const route = r
  const mine = route.user_id === userId
  const author = profiles.find((p) => p.id === route.user_id)
  const maxEle = Math.max(...route.track.map((p) => p[2] ?? -Infinity))

  function downloadGpx() {
    const blob = new Blob([trackToGpx(route.title, route.track)], { type: 'application/gpx+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${route.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'ruta'}.gpx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  async function copyToMine() {
    const { error, data } = await supabase
      .from('saved_routes')
      .insert({
        title: route.title,
        description: route.description,
        kind: route.kind,
        distance_m: route.distance_m,
        elevation_gain_m: route.elevation_gain_m,
        elevation_loss_m: route.elevation_loss_m,
        track: route.track,
      })
      .select('id')
      .single()
    if (error || !data) return toast('No se pudo guardar la ruta')
    toast('Ruta guardada en tus rutas')
    navigate(`/ruta/${data.id}`, { replace: true })
  }

  async function remove() {
    const { error } = await supabase.from('saved_routes').delete().eq('id', route.id)
    if (error) return toast('No se pudo borrar la ruta')
    toast('Ruta borrada')
    navigate('/rutas', { replace: true })
  }

  return (
    <div className="rd">
      <PageHeader
        title="Ruta"
        right={
          <button className="header-btn" aria-label="Opciones de la ruta" onClick={() => setMenu('main')}>
            <Icon name="more" />
          </button>
        }
      />
      <div className="wd-body rd-body">
        <div className="av-map">
          <Suspense fallback={<StaticMap track={route.track} className="av-static" />}>
            <RouteMap track={route.track} highlight={sel} />
          </Suspense>
        </div>

        <h1 className="rd-title">{route.title}</h1>
        {!mine && (
          <p className="rd-author">
            <Avatar url={author?.avatar_url} name={author?.full_name} size={24} /> Ruta de {author?.full_name ?? 'tu hermano'}
          </p>
        )}
        {route.description && <p className="wd-desc">{route.description}</p>}

        <div className="av-stats">
          <div>
            <span>Distancia</span>
            <b className="tnum">{fmtKm(route.distance_m)}</b>
          </div>
          <div>
            <span>Desnivel +</span>
            <b className="tnum">{Math.round(route.elevation_gain_m)} m</b>
          </div>
          <div>
            <span>Desnivel −</span>
            <b className="tnum">{Math.round(route.elevation_loss_m)} m</b>
          </div>
          <div>
            <span>Tiempo estimado</span>
            <b className="tnum">{fmtDuration(estimateSeconds(route.kind, route.distance_m, route.elevation_gain_m))}</b>
          </div>
          {Number.isFinite(maxEle) && (
            <div>
              <span>Altitud máx.</span>
              <b className="tnum">{Math.round(maxEle)} m</b>
            </div>
          )}
          <div>
            <span>Tipo</span>
            <b>{KIND_LABEL[route.kind]}</b>
          </div>
        </div>

        <button className="btn btn-primary btn-block rd-follow" onClick={() => navigate(`/ruta/${route.id}/seguir`)}>
          <Icon name="play" size={20} />
          Seguir ruta
        </button>
        {!mine && (
          <button className="btn btn-block" onClick={copyToMine}>
            Guardar en mis rutas
          </button>
        )}

        {route.track.some((p) => p[2] != null) && <ElevationProfile track={route.track} selected={sel} onSelect={setSel} />}
      </div>

      <Sheet open={menu === 'main'} onClose={() => setMenu(null)} title={route.title}>
        <SheetItem icon={<Icon name="arrowDown" size={20} />} onClick={() => (downloadGpx(), setMenu(null))}>
          Descargar GPX
        </SheetItem>
        {mine && (
          <SheetItem danger icon={<Icon name="trash" size={20} />} onClick={() => setMenu('delete')}>
            Borrar ruta
          </SheetItem>
        )}
      </Sheet>
      <Sheet open={menu === 'delete'} onClose={() => setMenu(null)} title="¿Borrar la ruta?">
        <div className="sheet-confirm">
          <p>Se quitará de tu biblioteca. Las actividades que hiciste siguiéndola no se borran.</p>
          <button className="btn btn-danger btn-block" onClick={remove}>
            Borrar ruta
          </button>
          <button className="btn btn-block" onClick={() => setMenu(null)}>
            Cancelar
          </button>
        </div>
      </Sheet>
    </div>
  )
}
