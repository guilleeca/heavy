import { toast } from '../lib/toast'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import type { Routine } from '../lib/routines'
import { Icon } from './Icon'
import { Sheet, SheetItem} from './ui'

/** Menú ⋯ de una rutina: editar, duplicar, mover a carpeta, eliminar. */
export function RoutineMenu({
  routine,
  open,
  onClose,
  onDeleted,
}: {
  routine: Routine
  open: boolean
  onClose: () => void
  onDeleted?: () => void
}) {
  const navigate = useNavigate()
  const { folders, routines, userId, refresh } = useData()
  const [view, setView] = useState<'main' | 'move' | 'delete'>('main')
  const close = () => {
    setView('main')
    onClose()
  }
  const myFolders = folders.filter((f) => f.user_id === userId)

  async function duplicate() {
    const position = Math.max(0, ...routines.filter((r) => r.user_id === userId).map((r) => r.position + 1))
    const { error } = await supabase.from('routines').insert({
      title: `${routine.title} (copia)`.slice(0, 80),
      notes: routine.notes,
      exercises: routine.exercises,
      folder_id: routine.folder_id,
      position,
    })
    close()
    if (error) return toast('No se pudo duplicar la rutina')
    await refresh()
    toast('Rutina duplicada')
  }

  async function move(folderId: string | null) {
    const { error } = await supabase.from('routines').update({ folder_id: folderId }).eq('id', routine.id)
    close()
    if (error) return toast('No se pudo mover la rutina')
    await refresh()
    toast('Rutina movida')
  }

  async function remove() {
    const { error } = await supabase.from('routines').delete().eq('id', routine.id)
    close()
    if (error) return toast('No se pudo eliminar la rutina')
    await refresh()
    toast('Rutina eliminada')
    onDeleted?.()
  }

  return (
    <Sheet open={open} onClose={close} title={view === 'move' ? 'Mover a carpeta' : routine.title}>
      {view === 'main' && (
        <>
          <SheetItem icon={<Icon name="edit" size={20} />} onClick={() => (close(), navigate(`/rutina/${routine.id}/editar`))}>
            Editar rutina
          </SheetItem>
          <SheetItem icon={<Icon name="copy" size={20} />} onClick={duplicate}>
            Duplicar rutina
          </SheetItem>
          <SheetItem icon={<Icon name="move" size={20} />} onClick={() => setView('move')}>
            Mover a carpeta
          </SheetItem>
          <SheetItem danger icon={<Icon name="trash" size={20} />} onClick={() => setView('delete')}>
            Eliminar rutina
          </SheetItem>
        </>
      )}
      {view === 'move' && (
        <>
          <SheetItem selected={!routine.folder_id} onClick={() => move(null)}>
            Mis rutinas (sin carpeta)
          </SheetItem>
          {myFolders.map((f) => (
            <SheetItem key={f.id} selected={routine.folder_id === f.id} onClick={() => move(f.id)}>
              {f.name}
            </SheetItem>
          ))}
        </>
      )}
      {view === 'delete' && (
        <div className="sheet-confirm">
          <p>¿Eliminar «{routine.title}»? Tus entrenos ya registrados no se borran.</p>
          <button className="btn btn-danger btn-block" onClick={remove}>
            Eliminar rutina
          </button>
          <button className="btn btn-block" onClick={() => setView('main')}>
            Cancelar
          </button>
        </div>
      )}
    </Sheet>
  )
}
