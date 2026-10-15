import { toast } from '../lib/toast'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon, type IconName } from '../components/Icon'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'
import { useData } from '../data/context'
import { fmtDuration, fmtVolume } from '../lib/workouts'
import { WorkoutCard } from '../components/WorkoutCard'
import './Profile.css'

const METRICS = ['Duración', 'Volumen', 'Repeticiones'] as const
const PANEL: { label: string; icon: IconName; to?: string }[] = [
  { label: 'Estadísticas', icon: 'chart' },
  { label: 'Ejercicios', icon: 'dumbbell', to: '/ejercicios' },
  { label: 'Medidas', icon: 'ruler' },
  { label: 'Calendario', icon: 'calendar' },
]

/** Perfil: datos del usuario, gráfica semanal y accesos a estadísticas. */
export function Profile() {
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('Duración')
  const [menu, setMenu] = useState(false)
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const name = profile?.full_name || session?.user.email?.split('@')[0] || 'Atleta'
  const handle = profile?.username || session?.user.email?.split('@')[0] || ''
  const avatar = profile?.avatar_url
  const { workouts, userId } = useData()
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
  const thisWeek = weeks[11].value
  const headline =
    metric === 'Duración' ? fmtDuration(thisWeek) : metric === 'Volumen' ? fmtVolume(thisWeek) : `${thisWeek} reps`
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
            <button role="menuitem" onClick={() => supabase.auth.signOut()}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>
      <div className="screen-body">
        <section className="pf-head">
          <div className="pf-avatar" aria-hidden="true">
            {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : name.charAt(0).toUpperCase()}
          </div>
          <div className="pf-info">
            <strong>{name}</strong>
            <div className="pf-stats">
              <div><span>Entrenamientos</span><b className="tnum">{mine.length}</b></div>
              <div><span>Seguidores</span><b className="tnum">0</b></div>
              <div><span>Siguiendo</span><b className="tnum">0</b></div>
            </div>
          </div>
        </section>
        <button className="btn btn-block">Editar perfil</button>

        <section className="card pf-chart">
          <div className="pf-chart-head">
            <div>
              <b className="tnum">{headline}</b> <span>esta semana</span>
            </div>
            <span className="pf-range">Últimas 12 semanas</span>
          </div>
          <div className="pf-bars" role="img" aria-label={`${metric} por semana, últimas 12 semanas`}>
            {weeks.map((w, i) => (
              <i key={i} className={i === 11 ? 'now' : ''} style={{ height: w.value ? `${Math.max(4, (w.value / max) * 100)}%` : undefined }} />
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
              <button key={p.label} className="btn pf-panel-btn" onClick={() => (p.to ? navigate(p.to) : toast('Disponible cuando registres entrenos'))}>
                <Icon name={p.icon} size={20} />
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <section className="stack">
          <h2 className="section-title">Entrenamientos</h2>
          {mine.length ? (
            mine.slice(0, 20).map((w) => <WorkoutCard key={w.id} workout={w} />)
          ) : (
            <div className="empty">
              <p>Cuando termines tu primer entreno aparecerá aquí.</p>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
