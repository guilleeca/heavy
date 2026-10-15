import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { Icon, type IconName } from './Icon'
import { useActiveWorkout } from '../workout/context'
import { useNow } from '../workout/useNow'
import { fmtClock } from '../lib/workouts'
import { RestBar } from '../pages/ActiveWorkout'
import '../pages/ActiveWorkout.css'
import './Layout.css'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/entrenamiento', label: 'Entrenamiento', icon: 'dumbbell' },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
]

/** Estructura común: contenido de cada pantalla + barra de pestañas inferior. */
export function Layout() {
  const { active } = useActiveWorkout()
  const navigate = useNavigate()

  // Al volver a abrir la app con un entreno a medias, se abre directamente
  const activeId = active?.id
  useEffect(() => {
    if (!activeId) return
    try {
      if (sessionStorage.getItem('heavy.resumed') === activeId) return
      sessionStorage.setItem('heavy.resumed', activeId)
    } catch {
      /* sin almacenamiento */
    }
    navigate('/entreno')
  }, [activeId, navigate])
  return (
    <div className={`layout ${active ? 'has-active' : ''}`}>
      <main className="layout-main">
        <Outlet />
      </main>
      {active && <RestBar />}
      {active && <ActiveBar />}
      <nav className="tabbar" aria-label="Secciones">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tab">
            <Icon name={t.icon} size={26} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Barra "Entreno en curso" sobre las pestañas, como en Hevy */
function ActiveBar() {
  const navigate = useNavigate()
  const { active } = useActiveWorkout()
  const now = useNow(1000)
  if (!active) return null
  return (
    <button className="activebar" onClick={() => navigate('/entreno')}>
      <span className="activebar-dot" />
      <span className="activebar-text">
        <b>Entreno en curso</b>
        <span>{active.title}</span>
      </span>
      <span className="activebar-time tnum">{fmtClock((now - active.startedAt) / 1000)}</span>
      <Icon name="chevronRight" size={18} />
    </button>
  )
}
