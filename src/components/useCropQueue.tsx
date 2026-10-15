import { useState } from 'react'
import { ImageCropper } from './ImageCropper'

/** Encuadra en cuadrado (1080 px) una o varias fotos seguidas antes de añadirlas */
export function useCropQueue(onFile: (file: File) => void) {
  const [state, setState] = useState<{ files: File[]; index: number }>({ files: [], index: 0 })
  const current = state.files[state.index]
  const next = () => setState((s) => (s.index + 1 < s.files.length ? { ...s, index: s.index + 1 } : { files: [], index: 0 }))

  const element = current ? (
    <ImageCropper
      key={`${state.index}-${current.name}-${current.lastModified}`}
      file={current}
      shape="square"
      size={1080}
      title="Encuadrar foto"
      step={state.files.length > 1 ? `${state.index + 1} de ${state.files.length}` : undefined}
      onCancel={next}
      onDone={(blob) => {
        onFile(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }))
        next()
      }}
    />
  ) : null

  return { enqueue: (files: File[]) => files.length && setState({ files, index: 0 }), element }
}
