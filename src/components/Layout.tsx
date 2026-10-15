import { NavLink, Outlet } from 'react-router'
import { Icon, type IconName } from './Icon'
import './Layout.css'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/entrenamiento', label: 'Entrenamiento', icon: 'dumbbell' },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
]

/** Estructura común: contenido de cada pantalla + barra de pestañas inferior. */
export function Layout() {
  return (
    <div className="layout">
      <main className="layout-main">
        <Outlet />
      </main>
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
