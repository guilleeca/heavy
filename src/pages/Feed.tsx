import { Icon } from '../components/Icon'

/** Inicio: el canal con los entrenos y rutas de los dos. */
export function Feed() {
  return (
    <>
      <header className="screen-header">
        <h1>Inicio</h1>
        <button className="header-btn" aria-label="Buscar">
          <Icon name="search" />
        </button>
        <button className="header-btn" aria-label="Notificaciones">
          <Icon name="bell" />
        </button>
      </header>
      <div className="screen-body">
        <div className="empty">
          <Icon name="dumbbell" size={44} stroke={1.5} />
          <strong>Todavía no hay entrenamientos</strong>
          <p>Aquí verás tus entrenos, carreras y rutas, y los de tu hermano, con me gusta y comentarios.</p>
        </div>
      </div>
    </>
  )
}
