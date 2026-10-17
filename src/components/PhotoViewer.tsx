import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import './PhotoViewer.css'

/** Fotos a pantalla completa: deslizar entre ellas, cerrar con la X, Escape o deslizando hacia abajo */
export function PhotoViewer({ urls, start = 0, onClose }: { urls: string[]; start?: number; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(start)
  const drag = useRef<{ y: number; x: number } | null>(null)
  const [dy, setDy] = useState(0)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  // Abrir en la foto tocada
  const [first] = useState(start)
  useEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = first * el.clientWidth
  }, [first])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const t = track.current
        if (t) t.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * t.clientWidth, behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  return createPortal(
    <div
      className="pv"
      role="dialog"
      aria-modal="true"
      aria-label="Fotos del entreno"
      style={{ background: `rgba(0, 0, 0, ${1 - Math.min(0.6, Math.abs(dy) / 400)})` }}
    >
      <header className="pv-top">
        <span className="tnum">{urls.length > 1 ? `${index + 1} / ${urls.length}` : ''}</span>
        <button className="pv-close" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={24} stroke={2.2} />
        </button>
      </header>
      <div
        ref={track}
        className="pv-track"
        style={{ transform: dy ? `translateY(${dy}px)` : undefined }}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onTouchStart={(e) => (drag.current = { y: e.touches[0].clientY, x: e.touches[0].clientX })}
        onTouchMove={(e) => {
          if (!drag.current) return
          const ddy = e.touches[0].clientY - drag.current.y
          const ddx = e.touches[0].clientX - drag.current.x
          // Solo si el gesto es claramente vertical (si no, es pasar de foto)
          if (Math.abs(ddy) > Math.abs(ddx) * 1.5) setDy(ddy)
        }}
        onTouchEnd={() => {
          drag.current = null
          if (Math.abs(dy) > 120) onClose()
          else setDy(0)
        }}
      >
        {urls.map((u, i) => (
          <div key={u} className="pv-slide">
            <img src={u} alt={`Foto ${i + 1}`} draggable={false} crossOrigin="anonymous" />
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <div className="pv-dots" aria-hidden="true">
          {urls.map((u, i) => (
            <i key={u} className={i === index ? 'on' : ''} />
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
