import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { gifUrl, type Exercise } from '../lib/exercises'
import { Icon } from './Icon'
import './ui.css'

/** Miniatura redonda del ejercicio (primer fotograma animado de ExerciseDB). */
export function ExerciseThumb({ exercise, size = 44 }: { exercise?: Exercise; size?: number }) {
  const [failed, setFailed] = useState(false)
  const src = exercise ? gifUrl(exercise) : null
  return (
    <span className="thumb" style={{ width: size, height: size }} aria-hidden="true">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="thumb-letter">{exercise?.name.charAt(0).toUpperCase() ?? '?'}</span>
      )}
    </span>
  )
}

/** Cabecera de pantalla completa: Cancelar / Título / Acción */
export function PageHeader({
  title,
  left,
  right,
}: {
  title?: ReactNode
  left?: ReactNode
  right?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header-side">{left ?? <BackButton />}</div>
      <h1>{title}</h1>
      <div className="page-header-side right">{right}</div>
    </header>
  )
}

export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate()
  return (
    <button className="header-btn" aria-label="Volver" onClick={() => (to ? navigate(to) : navigate(-1))}>
      <Icon name="chevronLeft" />
    </button>
  )
}

/** Hoja inferior para menús y opciones (como las de Hevy). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-grip" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export function SheetItem({
  icon,
  children,
  onClick,
  danger,
  selected,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
  selected?: boolean
}) {
  return (
    <button className={`sheet-item ${danger ? 'danger' : ''}`} onClick={onClick} aria-pressed={selected}>
      {icon}
      <span>{children}</span>
      {selected && <Icon name="check" size={20} className="sheet-check" />}
    </button>
  )
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Cargando" />
}
