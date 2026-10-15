import { toast } from '../lib/toast'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import type { Folder, Routine } from '../lib/routines'
import { Icon } from '../components/Icon'
import { RoutineMenu } from '../components/RoutineMenu'
import { Sheet, SheetItem, Spinner} from '../components/ui'
import './Workout.css'

/** Entrenamiento: empezar un entreno y gestionar rutinas y carpetas. */
export function Workout() {
  const navigate = useNavigate()
  const { routines, folders, userId, ready, findExercise, refresh, error } = useData()
  const [closed, setClosed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('heavy.closedFolders') || '{}')
    } catch {
      return {}
    }
  })
  const [routineMenu, setRoutineMenu] = useState<Routine | null>(null)
  const [folderSheet, setFolderSheet] = useState<null | { mode: 'new' } | { mode: 'menu' | 'rename' | 'delete'; folder: Folder }>(null)
  const [folderName, setFolderName] = useState('')

  const mine = routines.filter((r) => r.user_id === userId)
  const myFolders = folders.filter((f) => f.user_id === userId)
  const loose = mine.filter((r) => !r.folder_id || !myFolders.some((f) => f.id === r.folder_id))

  const toggle = (key: string) =>
    setClosed((c) => {
      const next = { ...c, [key]: !c[key] }
      try {
        localStorage.setItem('heavy.closedFolders', JSON.stringify(next))
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      return next
    })

  async function saveFolder() {
    const name = folderName.trim()
    if (!name || !folderSheet) return
    const res =
      folderSheet.mode === 'new'
        ? await supabase.from('routine_folders').insert({ name, position: myFolders.length })
        : await supabase.from('routine_folders').update({ name }).eq('id', (folderSheet as { folder: Folder }).folder.id)
    setFolderSheet(null)
    if (res.error) return toast('No se pudo guardar la carpeta')
    await refresh()
  }

  async function deleteFolder(f: Folder) {
    const { error: e } = await supabase.from('routine_folders').delete().eq('id', f.id)
    setFolderSheet(null)
    if (e) return toast('No se pudo eliminar la carpeta')
    await refresh()
    toast('Carpeta eliminada. Sus rutinas pasan a «Mis rutinas».')
  }

  const card = (r: Routine) => (
    <article key={r.id} className="wk-card">
      <Link to={`/rutina/${r.id}`} className="wk-card-main">
        <h3>{r.title}</h3>
        <p>{r.exercises.map((e) => findExercise(e.exerciseId)?.name ?? '—').join(', ')}</p>
      </Link>
      <button className="header-btn wk-card-more" aria-label={`Opciones de ${r.title}`} onClick={() => setRoutineMenu(r)}>
        <Icon name="more" />
      </button>
      <button className="btn btn-primary btn-block" onClick={() => toast('El entreno en directo llega en el siguiente paso')}>
        Empezar rutina
      </button>
    </article>
  )

  const group = (key: string, label: string, list: Routine[], folder?: Folder) => (
    <section key={key} className="stack">
      <div className="wk-folder-row">
        <button className="wk-folder" onClick={() => toggle(key)} aria-expanded={!closed[key]}>
          <Icon name="chevronDown" size={18} className={closed[key] ? 'wk-closed' : ''} />
          {label} ({list.length})
        </button>
        {folder && (
          <button className="header-btn" aria-label={`Opciones de la carpeta ${folder.name}`} onClick={() => setFolderSheet({ mode: 'menu', folder })}>
            <Icon name="more" />
          </button>
        )}
      </div>
      {!closed[key] &&
        (list.length ? (
          list.map(card)
        ) : (
          <button className="wk-empty-folder" onClick={() => navigate(`/rutina/nueva${folder ? `?carpeta=${folder.id}` : ''}`)}>
            {folder ? 'Carpeta vacía. Toca para crear una rutina aquí.' : 'Crea tu primera rutina con sus ejercicios, series y descansos.'}
          </button>
        ))}
    </section>
  )

  return (
    <>
      <header className="screen-header">
        <h1>Entrenamiento</h1>
      </header>
      <div className="screen-body">
        <section className="stack">
          <h2 className="section-title">Inicio rápido</h2>
          <button className="btn btn-block wk-start" onClick={() => toast('El entreno en directo llega en el siguiente paso')}>
            <Icon name="plus" size={20} stroke={2.2} />
            Empezar entrenamiento vacío
          </button>
        </section>

        <section className="stack">
          <div className="wk-row">
            <h2 className="section-title">Rutinas</h2>
            <button
              className="header-btn"
              aria-label="Nueva carpeta"
              onClick={() => {
                setFolderName('')
                setFolderSheet({ mode: 'new' })
              }}
            >
              <Icon name="folderPlus" size={24} />
            </button>
          </div>
          <div className="wk-actions">
            <Link className="btn" to="/rutina/nueva">
              <Icon name="clipboard" size={20} />
              Nueva rutina
            </Link>
            <Link className="btn" to="/explorar">
              <Icon name="search" size={20} />
              Explorar
            </Link>
          </div>
        </section>

        {error && <p className="wk-error">{error}</p>}
        {!ready ? (
          <Spinner />
        ) : (
          <>
            {myFolders.map((f) => group(f.id, f.name, mine.filter((r) => r.folder_id === f.id), f))}
            {group('loose', 'Mis rutinas', loose)}
          </>
        )}
      </div>

      {routineMenu && <RoutineMenu routine={routineMenu} open onClose={() => setRoutineMenu(null)} />}

      <Sheet
        open={folderSheet?.mode === 'new' || folderSheet?.mode === 'rename'}
        onClose={() => setFolderSheet(null)}
        title={folderSheet?.mode === 'new' ? 'Nueva carpeta' : 'Renombrar carpeta'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveFolder()
          }}
        >
          <input
            id="folder-name"
            className="sheet-input"
            placeholder="Nombre de la carpeta (p. ej. Arnold Split)"
            value={folderName}
            maxLength={60}
            onChange={(e) => setFolderName(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary btn-block" disabled={!folderName.trim()}>
            Guardar
          </button>
        </form>
      </Sheet>

      <Sheet open={folderSheet?.mode === 'menu'} onClose={() => setFolderSheet(null)} title={folderSheet && 'folder' in folderSheet ? folderSheet.folder.name : ''}>
        {folderSheet && 'folder' in folderSheet && (
          <>
            <SheetItem icon={<Icon name="plus" size={20} />} onClick={() => navigate(`/rutina/nueva?carpeta=${folderSheet.folder.id}`)}>
              Nueva rutina en esta carpeta
            </SheetItem>
            <SheetItem
              icon={<Icon name="edit" size={20} />}
              onClick={() => {
                setFolderName(folderSheet.folder.name)
                setFolderSheet({ mode: 'rename', folder: folderSheet.folder })
              }}
            >
              Renombrar carpeta
            </SheetItem>
            <SheetItem danger icon={<Icon name="trash" size={20} />} onClick={() => setFolderSheet({ mode: 'delete', folder: folderSheet.folder })}>
              Eliminar carpeta
            </SheetItem>
          </>
        )}
      </Sheet>

      <Sheet open={folderSheet?.mode === 'delete'} onClose={() => setFolderSheet(null)} title="¿Eliminar carpeta?">
        {folderSheet && 'folder' in folderSheet && (
          <div className="sheet-confirm">
            <p>Las rutinas de «{folderSheet.folder.name}» no se borran: pasan a «Mis rutinas».</p>
            <button className="btn btn-danger btn-block" onClick={() => deleteFolder(folderSheet.folder)}>
              Eliminar carpeta
            </button>
            <button className="btn btn-block" onClick={() => setFolderSheet(null)}>
              Cancelar
            </button>
          </div>
        )}
      </Sheet>
    </>
  )
}
