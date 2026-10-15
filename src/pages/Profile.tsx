import { toast } from '../lib/toast'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon, type IconName } from '../components/Icon'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'
import { useData } from '../data/context'
import { fmtDuration, fmtVolume } from '../lib/workouts'
import { WorkoutCard } from '../components/WorkoutCard'
import { Sheet } from '../components/ui'
import './Profile.css'

const METRICS = ['Duración', 'Volumen', 'Repeticiones'] as const
const PANEL: { label: string; icon: IconName; to: string }[] = [
  { label: 'Estadísticas', icon: 'chart', to: '/estadisticas' },
  { label: 'Ejercicios', icon: 'dumbbell', to: '/ejercicios' },
  { label: 'Medidas', icon: 'ruler', to: '/medidas' },
  { label: 'Calendario', icon: 'calendar', to: '/calendario' },
]

/** Perfil: datos del usuario, gráfica semanal y accesos a estadísticas. */
export function Profile() {
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('Duración')
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [limit, setLimit] = useState(20)
  const navigate = useNavigate()
  const { profile: authProfile, session } = useAuth()
  const { workouts, userId, profiles } = useData()
  const profile = profiles.find((p) => p.id === userId) ?? authProfile
  const name = profile?.full_name || session?.user.email?.split('@')[0] || 'Atleta'
  const handle = profile?.username || session?.user.email?.split('@')[0] || ''
  const avatar = profile?.avatar_url
  const mine = workouts.filter((w) => w.user_id === userId)

  // Últimas 12 semanas (lunes a domingo)
  const [monday] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  })
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(monday)
    start.setDate(start.getDate() - (11 - i) * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const list = mine.filter((w) => {
      const t = new Date(w.started_at)
      return t >= start && t < end
    })
    const value =
      metric === 'Duración'
        ? list.reduce((a, w) => a + w.duration_s, 0)
        : metric === 'Volumen'
          ? list.reduce((a, w) => a + w.volume_kg, 0)
          : list.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.reduce((c, x) => c + (x.reps ?? 0), 0), 0), 0)
    return { start, value }
  })
  const max = Math.max(1, ...weeks.map((w) => w.value))
  const shownWeek = picked ?? 11
  const weekValue = weeks[shownWeek].value
  const headline =
    metric === 'Duración' ? fmtDuration(weekValue) : metric === 'Volumen' ? fmtVolume(weekValue) : `${weekValue} reps`
  const weekLabel =
    shownWeek === 11 ? 'esta semana' : `semana del ${weeks[shownWeek].start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
  return (
    <>
      <header className="screen-header">
        <h1>{handle}</h1>
        <button className="header-btn" aria-label="Compartir perfil">
          <Icon name="share" />
        </button>
        <button className="header-btn" aria-label="Ajustes" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <Icon name="gear" />
        </button>
        {menu && (
          <div className="pf-menu" role="menu">
            <p>{session?.user.email}</p>
            <button role="menuitem" className="plain" onClick={() => navigate('/importar')}>
              Importar de Hevy
            </button>
            <button role="menuitem" onClick={() => supabase.auth.signOut()}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>
      <div className="screen-body">
        <section className="pf-head">
          <button className="pf-avatar" aria-label="Cambiar foto de perfil" onClick={() => setEditing(true)}>
            {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : name.charAt(0).toUpperCase()}
          </button>
          <div className="pf-info">
            <strong>{name}</strong>
            <div className="pf-stats">
              <div><span>Entrenamientos</span><b className="tnum">{mine.length}</b></div>
              <div><span>Seguidores</span><b className="tnum">0</b></div>
              <div><span>Siguiendo</span><b className="tnum">0</b></div>
            </div>
          </div>
        </section>
        {profile?.bio && <p className="pf-bio">{profile.bio}</p>}
        <button className="btn btn-block" onClick={() => setEditing(true)}>
          Editar perfil
        </button>

        <section className="card pf-chart">
          <div className="pf-chart-head">
            <div>
              <b className="tnum">{headline}</b> <span>{weekLabel}</span>
            </div>
            <span className="pf-range">Últimas 12 semanas</span>
          </div>
          <div className="pf-bars" role="img" aria-label={`${metric} por semana, últimas 12 semanas`}>
            {weeks.map((w, i) => (
              <button
                key={i}
                className={i === shownWeek ? 'now' : ''}
                aria-label={`Semana del ${w.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                onClick={() => setPicked(i === 11 ? null : i)}
              >
                <i style={{ height: w.value ? `${Math.max(4, (w.value / max) * 100)}%` : undefined }} />
              </button>
            ))}
          </div>
          <div className="pf-axis" aria-hidden="true">
            <span>{weeks[0].start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
            <span>Esta semana</span>
          </div>
          <div className="pf-chips" role="group" aria-label="Métrica">
            {METRICS.map((m) => (
              <button key={m} className="pf-chip" aria-pressed={metric === m} onClick={() => setMetric(m)}>
                {m}
              </button>
            ))}
          </div>
        </section>

        <section className="stack">
          <h2 className="section-title">Panel</h2>
          <div className="pf-panel">
            {PANEL.map((p) => (
              <button key={p.label} className="btn pf-panel-btn" onClick={() => navigate(p.to)}>
                <Icon name={p.icon} size={20} />
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <section className="stack">
          <h2 className="section-title">Entrenamientos</h2>
          {mine.length ? (
            <>
              {mine.slice(0, limit).map((w) => (
                <WorkoutCard key={w.id} workout={w} />
              ))}
              {mine.length > limit && (
                <button className="btn btn-block" onClick={() => setLimit(limit + 20)}>
                  Ver más entrenos
                </button>
              )}
            </>
          ) : (
            <div className="empty">
              <p>Cuando termines tu primer entreno aparecerá aquí.</p>
            </div>
          )}
        </section>
      </div>
      {editing && <EditProfile onClose={() => setEditing(false)} initial={{ full_name: name, username: profile?.username ?? '', bio: profile?.bio ?? '', avatar_url: profile?.avatar_url ?? null }} />}
    </>
  )
}

/** Reduce la foto a 512 px (JPEG) para que pese poco */
async function shrinkImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const size = Math.min(bmp.width, bmp.height)
  const out = Math.min(512, size)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')!
  // Recorte cuadrado centrado
  ctx.drawImage(bmp, (bmp.width - size) / 2, (bmp.height - size) / 2, size, size, 0, 0, out, out)
  bmp.close()
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('foto'))), 'image/jpeg', 0.85))
}

const AVATAR_PREFIX = '/storage/v1/object/public/avatars/'

/** Editar foto, nombre, usuario y biografía */
function EditProfile({
  initial,
  onClose,
}: {
  initial: { full_name: string; username: string; bio: string; avatar_url: string | null }
  onClose: () => void
}) {
  const { userId, refresh } = useData()
  const [form, setForm] = useState(initial)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const shown = photo?.url ?? (removePhoto ? null : form.avatar_url)

  async function pick(file?: File) {
    if (!file) return
    try {
      const blob = await shrinkImage(file)
      setPhoto({ blob, url: URL.createObjectURL(blob) })
      setRemovePhoto(false)
    } catch {
      toast('No se pudo leer esa foto')
    }
  }

  async function save() {
    const username = form.username.trim().toLowerCase()
    if (!form.full_name.trim()) return toast('Escribe tu nombre')
    if (username && !/^[a-z0-9._]{3,30}$/.test(username)) return toast('Usuario: 3-30 letras, números, punto o guion bajo')
    setSaving(true)
    let avatar_url = removePhoto ? null : initial.avatar_url
    if (photo) {
      const path = `${userId}/${Date.now()}.jpg`
      const up = await supabase.storage.from('avatars').upload(path, photo.blob, { contentType: 'image/jpeg' })
      if (up.error) {
        setSaving(false)
        return toast('No se pudo subir la foto')
      }
      avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    }
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name.trim(), username: username || null, bio: form.bio.trim(), avatar_url })
      .eq('id', userId)
    setSaving(false)
    if (error) return toast(error.code === '23505' ? 'Ese nombre de usuario ya existe' : 'No se pudo guardar el perfil')
    // La foto anterior subida a Heavy ya no hace falta
    const old = initial.avatar_url
    if (old && old !== avatar_url && old.includes(AVATAR_PREFIX)) {
      await supabase.storage.from('avatars').remove([decodeURIComponent(old.split(AVATAR_PREFIX)[1])])
    }
    await refresh()
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Editar perfil">
      <div className="pf-form">
        <div className="pf-photo">
          <div className="pf-avatar">{shown ? <img src={shown} alt="" referrerPolicy="no-referrer" /> : form.full_name.charAt(0).toUpperCase()}</div>
          <div className="pf-photo-btns">
            <label className="btn">
              Cambiar foto
              <input type="file" accept="image/*" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
            </label>
            {shown && (
              <button className="btn pf-photo-remove" onClick={() => (setPhoto(null), setRemovePhoto(true))}>
                Quitar
              </button>
            )}
          </div>
        </div>
        <label>
          <span>Nombre</span>
          <input value={form.full_name} maxLength={60} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </label>
        <label>
          <span>Usuario</span>
          <input
            value={form.username}
            maxLength={30}
            autoCapitalize="none"
            placeholder="tu_usuario"
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </label>
        <label>
          <span>Biografía</span>
          <textarea value={form.bio} maxLength={160} rows={3} placeholder="Algo sobre ti" onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </label>
        <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Sheet>
  )
}
