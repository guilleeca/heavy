import { useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import './Profile.css'

const METRICS = ['Duración', 'Volumen', 'Repeticiones'] as const
const PANEL: { label: string; icon: IconName }[] = [
  { label: 'Estadísticas', icon: 'chart' },
  { label: 'Ejercicios', icon: 'dumbbell' },
  { label: 'Medidas', icon: 'ruler' },
  { label: 'Calendario', icon: 'calendar' },
]

/** Perfil: datos del usuario, gráfica semanal y accesos a estadísticas. */
export function Profile() {
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('Duración')
  return (
    <>
      <header className="screen-header">
        <h1>guilleeca</h1>
        <button className="header-btn" aria-label="Compartir perfil">
          <Icon name="share" />
        </button>
        <button className="header-btn" aria-label="Ajustes">
          <Icon name="gear" />
        </button>
      </header>
      <div className="screen-body">
        <section className="pf-head">
          <div className="pf-avatar" aria-hidden="true">G</div>
          <div className="pf-info">
            <strong>Guillermo</strong>
            <div className="pf-stats">
              <div><span>Entrenamientos</span><b className="tnum">0</b></div>
              <div><span>Seguidores</span><b className="tnum">0</b></div>
              <div><span>Siguiendo</span><b className="tnum">0</b></div>
            </div>
          </div>
        </section>
        <button className="btn btn-block">Editar perfil</button>

        <section className="card pf-chart">
          <div className="pf-chart-head">
            <div>
              <b className="tnum">0 horas</b> <span>esta semana</span>
            </div>
            <span className="pf-range">Últimas 12 semanas</span>
          </div>
          <div className="pf-bars" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => <i key={i} />)}
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
              <button key={p.label} className="btn pf-panel-btn">
                <Icon name={p.icon} size={20} />
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <section className="stack">
          <h2 className="section-title">Entrenamientos</h2>
          <div className="empty">
            <p>Cuando termines tu primer entreno aparecerá aquí.</p>
          </div>
        </section>
      </div>
    </>
  )
}
