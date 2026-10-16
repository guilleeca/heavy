import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import {
  activityTitle,
  fmtKm,
  fmtPace,
  KIND_EMOJI,
  KIND_LABEL,
  paceLabel,
  parseActivityFile,
  stravaGpxLink,
  type ActivityKind,
  type ParsedActivity,
} from '../lib/gpx'
import { fmtDuration, uid } from '../lib/workouts'
import { Icon } from '../components/Icon'
import { PageHeader, Sheet, SheetItem } from '../components/ui'
import { StaticMap } from '../components/StaticMap'
import { WhenFields } from '../components/WhenFields'
import { useCropQueue } from '../components/useCropQueue'
import './RoutineEditor.css'
import './FinishWorkout.css'
import '../components/CustomExerciseForm.css'
import './ImportActivity.css'

const KINDS: ActivityKind[] = ['run', 'hike', 'walk', 'ride']
/** Importar una carrera, ruta o salida en bici desde un archivo GPX/TCX */
export function ImportActivity() {
  const navigate = useNavigate()
  const { userId, workouts, refresh } = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedActivity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<ActivityKind>('run')
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [when, setWhen] = useState<{ startedAt: number; durationS: number } | null>(null)
  const [visibility, setVisibility] = useState<'everyone' | 'private'>('everyone')
  const [photos, setPhotos] = useState<File[]>([])
  const [sheet, setSheet] = useState<'visibility' | null>(null)
  const [saving, setSaving] = useState(false)
  const crop = useCropQueue((f) => setPhotos((p) => [...p, f].slice(0, 6)))
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos])

  async function onFile(file?: Blob) {
    if (!file) return
    setError(null)
    try {
      const a = parseActivityFile(await file.text())
      const start = a.startedAt ?? Date.now() - (a.durationS ?? 3600) * 1000
      setParsed(a)
      setKind(a.kind)
      setWhen({ startedAt: start, durationS: a.durationS ?? 0 })
      setTitle(a.name && !/^(activity|actividad|track|ruta)?\s*\d*$/i.test(a.name) ? a.name : activityTitle(a.kind, start))
      setTitleTouched(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  // Llegada desde "Compartir con Heavy" (archivo o enlace de Strava)
  const [params, setParams] = useSearchParams()
  const [link, setLink] = useState(() => params.get('enlace') ?? '')
  const [opened, setOpened] = useState<null | 'direct' | 'page'>(null)
  const shared = params.get('compartido') === '1'
  useEffect(() => {
    if (!shared) return
    ;(async () => {
      try {
        const cache = await caches.open('heavy-share')
        const key = new URL('shared-activity-file', document.baseURI).href
        const res = await cache.match(key)
        if (res) {
          await onFile(await res.blob())
          await cache.delete(key)
        }
      } catch {
        setError('No se pudo leer el archivo compartido. Elígelo a mano.')
      }
      setParams({}, { replace: true })
    })()
    // Solo al llegar
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [shared])
  const strava = stravaGpxLink(link)

  const duplicate =
    when &&
    workouts.some((w) => w.user_id === userId && w.kind && w.kind !== 'gym' && Math.abs(new Date(w.started_at).getTime() - when.startedAt) < 60000)

  async function save() {
    if (!parsed || !when) return
    if (!when.durationS) return toast('Indica la duración de la actividad')
    setSaving(true)
    const id = uid()
    const paths: string[] = []
    for (const f of photos) {
      const path = `${userId}/${id}/${uid()}.jpg`
      const up = await supabase.storage.from('workout-photos').upload(path, f, { contentType: f.type })
      if (!up.error) paths.push(path)
    }
    // Si se ha cambiado la duración a mano, el tiempo en movimiento ya no vale
    const moving = parsed.movingS != null && when.durationS === parsed.durationS ? parsed.movingS : null
    const { error } = await supabase.from('workouts').insert({
      id,
      kind,
      title: title.trim() || activityTitle(kind, when.startedAt),
      description: description.trim(),
      started_at: new Date(when.startedAt).toISOString(),
      ended_at: new Date(when.startedAt + when.durationS * 1000).toISOString(),
      duration_s: when.durationS,
      moving_s: moving,
      distance_m: parsed.distanceM,
      elevation_gain_m: parsed.elevationGainM,
      track: parsed.track,
      volume_kg: 0,
      sets_count: 0,
      exercises: [],
      photos: paths,
      visibility,
    })
    setSaving(false)
    if (error) {
      return toast(error.message.includes('kind') ? 'Falta ejecutar 008_rutas.sql en Supabase' : 'No se pudo guardar la actividad')
    }
    await refresh()
    navigate(`/entreno/${id}?nuevo=1`, { replace: true })
  }

  const time = parsed?.movingS && when?.durationS === parsed.durationS ? parsed.movingS : (when?.durationS ?? 0)

  return (
    <div className="ia">
      <PageHeader
        title="Nueva actividad"
        right={
          parsed && (
            <button className="save-btn" disabled={saving} onClick={save}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          )
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".gpx,.tcx,application/gpx+xml,application/xml,text/xml"
        hidden
        onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))}
      />

      {!parsed ? (
        <div className="fw-body">
          <button className="ia-drop" onClick={() => fileRef.current?.click()}>
            <Icon name="route" size={40} stroke={1.5} />
            <b>Elegir archivo GPX o TCX</b>
            <span>Carrera, senderismo, caminata o bici</span>
          </button>
          {error && <p className="ih-error ia-error">{error}</p>}

          <section className="card ia-strava">
            <h2>Desde Strava</h2>
            <p>
              En la app de Strava abre la actividad → <b>Compartir</b> → <b>Copiar enlace</b>, y pégalo aquí (o compártelo directamente con Heavy).
            </p>
            <div className="ia-link">
              <input
                value={link}
                inputMode="url"
                placeholder="strava.com/activities/…"
                aria-label="Enlace de la actividad de Strava"
                onChange={(e) => (setLink(e.target.value), setOpened(null))}
              />
              <button
                className="btn btn-primary"
                disabled={!strava}
                onClick={() => {
                  if (!strava) return
                  window.open(strava.url, '_blank', 'noopener')
                  setOpened(strava.direct ? 'direct' : 'page')
                }}
              >
                Descargar GPX
              </button>
            </div>
            {link && !strava && <p className="ia-note">Ese enlace no parece de una actividad de Strava.</p>}
            {opened === 'direct' && (
              <p className="ia-note ok">
                Se está descargando el GPX. Cuando acabe, toca <b>Compartir</b> en la descarga y elige <b>Heavy</b>, o vuelve aquí y pulsa{' '}
                <b>Elegir archivo</b>. Si en vez de descargarse te pide entrar, inicia sesión en Strava en el navegador y repite.
              </p>
            )}
            {opened === 'page' && (
              <p className="ia-note ok">
                Se ha abierto la actividad. Si se abre en el navegador, copia la dirección (strava.com/activities/…) y pégala aquí para descargar el
                GPX.
              </p>
            )}
          </section>
          <section className="card ia-help">
            <h2>¿De dónde saco el archivo?</h2>
            <ul>
              <li>
                <b>Strava</b> (desde la web): abre la actividad → menú <b>⋯</b> → <b>Exportar GPX</b>. O usa el enlace de arriba.
              </li>
              <li>
                <b>Garmin Connect</b>: abre la actividad → <b>⚙</b> → <b>Exportar a GPX</b> (o TCX).
              </li>
              <li>
                <b>Wikiloc</b>: en la ruta, <b>Descargar</b> → GPX.
              </li>
              <li>Cualquier app o reloj que permita exportar o compartir la actividad como GPX.</li>
            </ul>
          </section>
        </div>
      ) : (
        <div className="fw-body">
          <div className="ia-map">
            <StaticMap track={parsed.track} />
          </div>

          <div className="ia-kinds" role="radiogroup" aria-label="Tipo de actividad">
            {KINDS.map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k)
                  if (!titleTouched && when) setTitle(activityTitle(k, when.startedAt))
                }}
              >
                <span aria-hidden="true">{KIND_EMOJI[k]}</span> {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <input
            className="re-title"
            placeholder="Título de la actividad"
            value={title}
            maxLength={80}
            onChange={(e) => (setTitle(e.target.value), setTitleTouched(true))}
          />

          <div className="fw-stats ia-stats">
            <div>
              <span>Distancia</span>
              <b className="tnum">{fmtKm(parsed.distanceM)}</b>
            </div>
            <div>
              <span>Tiempo</span>
              <b className="tnum">{time ? fmtDuration(time) : '—'}</b>
            </div>
            <div>
              <span>{paceLabel(kind)}</span>
              <b className="tnum">{fmtPace(time, parsed.distanceM, kind)}</b>
            </div>
            <div>
              <span>Desnivel +</span>
              <b className="tnum">{parsed.elevationGainM} m</b>
            </div>
          </div>
          {!parsed.startedAt && <p className="fw-warn">El archivo no tiene horas: indica cuándo empezaste y cuánto duró.</p>}
          {duplicate && <p className="fw-warn">Ya tienes una actividad que empezó a esa misma hora. ¿Seguro que no está repetida?</p>}

          {when && <WhenFields key={parsed.track.length} startedAt={when.startedAt} durationS={when.durationS} onChange={setWhen} />}

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
            className="fw-desc"
            placeholder="¿Qué tal ha ido? Añade notas sobre la actividad…"
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

          <button className="btn btn-block" onClick={() => fileRef.current?.click()}>
            Elegir otro archivo
          </button>
        </div>
      )}

      <Sheet open={sheet === 'visibility'} onClose={() => setSheet(null)} title="¿Quién puede verla?">
        <SheetItem selected={visibility === 'everyone'} onClick={() => (setVisibility('everyone'), setSheet(null))}>
          Todos (tu hermano la verá en Inicio)
        </SheetItem>
        <SheetItem selected={visibility === 'private'} onClick={() => (setVisibility('private'), setSheet(null))}>
          Solo yo
        </SheetItem>
      </Sheet>
      {crop.element}
    </div>
  )
}
