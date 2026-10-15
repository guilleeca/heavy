import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../data/context'
import { PageHeader, Sheet } from '../components/ui'
import { WorkoutCard } from '../components/WorkoutCard'
import { dayKey, weekStreak } from '../lib/stats'
import type { Workout } from '../lib/workouts'
import './Calendar.css'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Calendario: días entrenados mes a mes, racha y totales */
export function Calendar() {
  const navigate = useNavigate()
  const { workouts, userId } = useData()
  const mine = workouts.filter((w) => w.user_id === userId)
  const [today] = useState(() => new Date())
  const [months, setMonths] = useState(6)
  const [day, setDay] = useState<Workout[] | null>(null)

  const byDay = new Map<string, Workout[]>()
  for (const w of mine) {
    const k = dayKey(new Date(w.started_at))
    byDay.set(k, [...(byDay.get(k) ?? []), w])
  }
  const oldest = mine.length ? new Date(mine[mine.length - 1].started_at) : today
  const maxMonths = (today.getFullYear() - oldest.getFullYear()) * 12 + today.getMonth() - oldest.getMonth() + 1
  const streak = weekStreak(mine, today)
  const thisMonth = mine.filter((w) => {
    const d = new Date(w.started_at)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }).length

  function open(list: Workout[]) {
    if (list.length === 1) navigate(`/entreno/${list[0].id}`)
    else setDay(list)
  }

  return (
    <div className="cal">
      <PageHeader title="Calendario" />
      <div className="cal-body">
        <section className="cal-stats">
          <div>
            <b className="tnum">{streak}</b>
            <span>{streak === 1 ? 'semana seguida' : 'semanas seguidas'}</span>
          </div>
          <div>
            <b className="tnum">{thisMonth}</b>
            <span>entrenos este mes</span>
          </div>
          <div>
            <b className="tnum">{mine.length}</b>
            <span>en total</span>
          </div>
        </section>

        {Array.from({ length: Math.min(months, Math.max(1, maxMonths)) }, (_, i) => {
          const first = new Date(today.getFullYear(), today.getMonth() - i, 1)
          const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
          const lead = (first.getDay() + 6) % 7
          let count = 0
          const cells = Array.from({ length: days }, (_, d) => {
            const date = new Date(first.getFullYear(), first.getMonth(), d + 1)
            const list = byDay.get(dayKey(date)) ?? []
            if (list.length) count++
            const isToday = dayKey(date) === dayKey(today)
            return (
              <button
                key={d}
                className={`cal-day ${list.length ? 'on' : ''} ${isToday ? 'today' : ''}`}
                disabled={!list.length}
                onClick={() => open(list)}
                aria-label={`${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}${list.length ? `: ${list.length} entreno(s)` : ''}`}
              >
                {d + 1}
              </button>
            )
          })
          return (
            <section key={i} className="cal-month">
              <header>
                <h2>{first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                <span>{count ? `${count} ${count === 1 ? 'día' : 'días'}` : ''}</span>
              </header>
              <div className="cal-grid">
                {WEEKDAYS.map((w, k) => (
                  <span key={k} className="cal-wd">
                    {w}
                  </span>
                ))}
                {Array.from({ length: lead }, (_, k) => (
                  <span key={`e${k}`} />
                ))}
                {cells}
              </div>
            </section>
          )
        })}

        {months < maxMonths && (
          <button className="btn btn-block" onClick={() => setMonths(months + 6)}>
            Ver meses anteriores
          </button>
        )}
      </div>

      <Sheet open={!!day} onClose={() => setDay(null)} title="Entrenos del día">
        <div className="cal-sheet">{day?.map((w) => <WorkoutCard key={w.id} workout={w} />)}</div>
      </Sheet>
    </div>
  )
}
