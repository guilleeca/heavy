import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ImageCropper.css'

type Pt = { x: number; y: number }

/** Encuadrar una foto en cuadrado (perfil en círculo, entrenos en cuadrado):
    arrastrar para mover y pellizcar (o la barra) para hacer zoom */
export function ImageCropper({
  file,
  onCancel,
  onDone,
  shape = 'circle',
  size = 512,
  title = 'Mover y escalar',
  step,
}: {
  file: File
  onCancel: () => void
  onDone: (blob: Blob) => void
  shape?: 'circle' | 'square'
  /** Lado en px de la imagen final */
  size?: number
  title?: string
  /** "1 de 3" cuando se encuadran varias seguidas */
  step?: string
}) {
  const [src] = useState(() => URL.createObjectURL(file))
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [V] = useState(() => Math.min(window.innerWidth - 48, 340)) // tamaño del círculo
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, Pt>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  useEffect(() => {
    const i = new Image()
    i.onload = () => {
      setImg(i)
      // Centrado al abrir
      const s = V / Math.min(i.naturalWidth, i.naturalHeight)
      setPos({ x: (V - i.naturalWidth * s) / 2, y: (V - i.naturalHeight * s) / 2 })
    }
    i.src = src
    return () => URL.revokeObjectURL(src)
  }, [src, V])

  if (!img) return createPortal(<div className="ac" />, document.body)

  const base = V / Math.min(img.naturalWidth, img.naturalHeight)
  const scale = base * zoom
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  // La foto siempre cubre todo el círculo
  const clamp = (p: Pt, ww = w, hh = h): Pt => ({ x: Math.min(0, Math.max(V - ww, p.x)), y: Math.min(0, Math.max(V - hh, p.y)) })

  /** Zoom manteniendo fijo el centro del círculo */
  const applyZoom = (z: number) => {
    const nz = Math.min(4, Math.max(1, z))
    const ns = base * nz
    const cx = (V / 2 - pos.x) / scale
    const cy = (V / 2 - pos.y) / scale
    setZoom(nz)
    setPos(clamp({ x: V / 2 - cx * ns, y: V / 2 - cy * ns }, img.naturalWidth * ns, img.naturalHeight * ns))
  }

  const dist = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function done() {
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, V / scale, V / scale, 0, 0, size, size)
    canvas.toBlob((b) => b && onDone(b), 'image/jpeg', 0.88)
  }

  return createPortal(
    <div className="ac" role="dialog" aria-modal="true" aria-label={title}>
      <header className="ac-top">
        <button className="text-btn" onClick={onCancel}>
          Cancelar
        </button>
        <b>
          {title}
          {step && <small>{step}</small>}
        </b>
        <button className="ac-ok" onClick={done}>
          Listo
        </button>
      </header>

      <div
        className="ac-stage"
        style={{ width: V, height: V }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          if (pointers.current.size === 2) pinch.current = { dist: dist(), zoom }
        }}
        onPointerMove={(e) => {
          const prev = pointers.current.get(e.pointerId)
          if (!prev) return
          const cur = { x: e.clientX, y: e.clientY }
          pointers.current.set(e.pointerId, cur)
          if (pointers.current.size === 2 && pinch.current) applyZoom((pinch.current.zoom * dist()) / pinch.current.dist)
          else if (pointers.current.size === 1) setPos((p) => clamp({ x: p.x + cur.x - prev.x, y: p.y + cur.y - prev.y }))
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId)
          if (pointers.current.size < 2) pinch.current = null
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId)
          pinch.current = null
        }}
        onWheel={(e) => applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.93))}
      >
        <img src={src} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${pos.x}px, ${pos.y}px)` }} />
        <div className={`ac-mask ${shape}`} />
      </div>

      <label className="ac-zoom">
        <span aria-hidden="true">−</span>
        <input type="range" min={1} max={4} step={0.01} value={zoom} aria-label="Zoom" onChange={(e) => applyZoom(Number(e.target.value))} />
        <span aria-hidden="true">+</span>
      </label>
      <p className="ac-hint">Arrastra para colocar la foto y pellizca o usa la barra para acercar.</p>
    </div>,
    document.body,
  )
}
