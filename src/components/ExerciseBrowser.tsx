import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../data/context'
import {
  EQUIPMENTS,
  EQUIPMENT_LABEL,
  MUSCLES,
  MUSCLE_LABEL,
  searchExercises,
  type Equipment,
  type Exercise,
  type Muscle,
} from '../lib/exercises'
import { Icon } from './Icon'
import { ExerciseThumb, Sheet, SheetItem, Spinner } from './ui'
import './ExerciseBrowser.css'

const PAGE = 50

type Props = {
  /** En modo selección se marcan varios y se devuelven con onDone */
  picking?: boolean
  onSelect?: (ex: Exercise) => void
  selected?: string[]
}

/** Lista de la biblioteca con buscador y filtros por equipamiento y músculo. */
export function ExerciseBrowser({ picking, onSelect, selected = [] }: Props) {
  const { exercises, ready, userId } = useData()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<Muscle | ''>('')
  const [equipment, setEquipment] = useState<Equipment | ''>('')
  const [sheet, setSheet] = useState<'muscle' | 'equipment' | null>(null)
  const [shown, setShown] = useState(PAGE)
  const sentinel = useRef<HTMLDivElement>(null)

  const results = useMemo(() => searchExercises(exercises, q, muscle, equipment), [exercises, q, muscle, equipment])
  const mine = results.filter((e) => e.custom && e.userId === userId)
  const rest = results.filter((e) => !(e.custom && e.userId === userId))

  // Cargar más filas al llegar al final
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setShown((n) => n + PAGE)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [results])

  const row = (e: Exercise) => {
    const isSel = selected.includes(e.id)
    return (
      <button key={e.id} className={`exb-row ${isSel ? 'selected' : ''}`} onClick={() => onSelect?.(e)} aria-pressed={picking ? isSel : undefined}>
        {isSel && <span className="exb-bar" />}
        <ExerciseThumb exercise={e} />
        <span className="exb-text">
          <b>{e.name}</b>
          <span>
            {MUSCLE_LABEL[e.muscle]}
            {e.ambiguous && e.nameEn ? ` · ${e.nameEn}` : ''}
          </span>
        </span>
        {!picking && <Icon name="chevronRight" size={18} className="exb-chev" />}
      </button>
    )
  }

  return (
    <div className="exb">
      <div className="exb-tools">
        <label className="exb-search">
          <Icon name="search" size={18} />
          <input
            id="exercise-search"
            type="search"
            placeholder="Buscar ejercicios"
            value={q}
            onChange={(ev) => {
              setQ(ev.target.value)
              setShown(PAGE)
            }}
            autoComplete="off"
          />
        </label>
        <div className="exb-filters">
          <button className={`exb-filter ${equipment ? 'on' : ''}`} onClick={() => setSheet('equipment')}>
            {equipment ? EQUIPMENT_LABEL[equipment] : 'Todo el equipamiento'}
            <Icon name="chevronDown" size={16} />
          </button>
          <button className={`exb-filter ${muscle ? 'on' : ''}`} onClick={() => setSheet('muscle')}>
            {muscle ? MUSCLE_LABEL[muscle] : 'Todos los músculos'}
            <Icon name="chevronDown" size={16} />
          </button>
        </div>
      </div>

      {!ready ? (
        <Spinner />
      ) : (
        <>
          {mine.length > 0 && (
            <>
              <h3 className="exb-group">Ejercicios personalizados</h3>
              {mine.map(row)}
            </>
          )}
          <h3 className="exb-group">{q || muscle || equipment ? `Resultados (${rest.length})` : 'Todos los ejercicios'}</h3>
          {rest.slice(0, shown).map(row)}
          {rest.length === 0 && <p className="exb-empty">Ningún ejercicio coincide. Puedes crearlo como personalizado.</p>}
          <div ref={sentinel} style={{ height: 1 }} />
        </>
      )}

      <Sheet open={sheet === 'equipment'} onClose={() => setSheet(null)} title="Equipamiento">
        <SheetItem selected={!equipment} onClick={() => (setEquipment(''), setSheet(null))}>
          Todo el equipamiento
        </SheetItem>
        {EQUIPMENTS.map((k) => (
          <SheetItem key={k} selected={equipment === k} onClick={() => (setEquipment(k), setShown(PAGE), setSheet(null))}>
            {EQUIPMENT_LABEL[k]}
          </SheetItem>
        ))}
      </Sheet>
      <Sheet open={sheet === 'muscle'} onClose={() => setSheet(null)} title="Músculo">
        <SheetItem selected={!muscle} onClick={() => (setMuscle(''), setSheet(null))}>
          Todos los músculos
        </SheetItem>
        {MUSCLES.map((k) => (
          <SheetItem key={k} selected={muscle === k} onClick={() => (setMuscle(k), setShown(PAGE), setSheet(null))}>
            {MUSCLE_LABEL[k]}
          </SheetItem>
        ))}
      </Sheet>
    </div>
  )
}
