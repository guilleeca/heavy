import { useState } from 'react'
import { Icon } from '../components/Icon'
import './Workout.css'

/** Entrenamiento: empezar un entreno y gestionar rutinas y carpetas. */
export function Workout() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <header className="screen-header">
        <h1>Entrenamiento</h1>
      </header>
      <div className="screen-body">
        <section className="stack">
          <h2 className="section-title">Inicio rápido</h2>
          <button className="btn btn-block wk-start">
            <Icon name="plus" size={20} stroke={2.2} />
            Empezar entrenamiento vacío
          </button>
        </section>

        <section className="stack">
          <div className="wk-row">
            <h2 className="section-title">Rutinas</h2>
            <button className="header-btn" aria-label="Nueva carpeta">
              <Icon name="folder" size={22} />
            </button>
          </div>
          <div className="wk-actions">
            <button className="btn">
              <Icon name="clipboard" size={20} />
              Nueva rutina
            </button>
            <button className="btn">
              <Icon name="search" size={20} />
              Explorar
            </button>
          </div>
        </section>

        <section className="stack">
          <button className="wk-folder" onClick={() => setOpen(!open)} aria-expanded={open}>
            <Icon name="chevronDown" size={18} className={open ? '' : 'wk-closed'} />
            Mis rutinas (0)
          </button>
          {open && (
            <div className="empty wk-empty">
              <p>Crea tu primera rutina con sus ejercicios, series y descansos para empezarla con un toque.</p>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
