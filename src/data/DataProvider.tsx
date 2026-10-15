import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { loadLibrary, type Exercise } from '../lib/exercises'
import type { Folder, Routine } from '../lib/routines'
import type { Profile } from '../auth/context'
import { useAuth } from '../auth/context'
import { DataContext } from './context'

type CustomRow = {
  id: string
  user_id: string
  name: string
  equipment: Exercise['equipment']
  muscle: Exercise['muscle']
  secondary_muscles: Exercise['muscle'][]
  exercise_type: Exercise['type']
}

const toExercise = (c: CustomRow): Exercise => ({
  id: `c:${c.id}`,
  name: c.name,
  equipment: c.equipment,
  muscle: c.muscle,
  secondary: c.secondary_muscles,
  type: c.exercise_type,
  custom: true,
  userId: c.user_id,
})

/** Carga y comparte ejercicios, rutinas, carpetas y perfiles de los dos usuarios. */
export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [library, setLibrary] = useState<Exercise[]>([])
  const [custom, setCustom] = useState<Exercise[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLibrary().then(setLibrary)
  }, [])

  const refresh = useCallback(async () => {
    const [c, r, f, p] = await Promise.all([
      supabase.from('custom_exercises').select('*').order('name'),
      supabase.from('routines').select('*').order('position').order('created_at'),
      supabase.from('routine_folders').select('*').order('position').order('created_at'),
      supabase.from('profiles').select('id, username, full_name, avatar_url, bio'),
    ])
    const err = c.error || r.error || f.error || p.error
    if (err) {
      setError('No se pudieron cargar tus datos. Revisa la conexión.')
    } else {
      setError(null)
      setCustom((c.data as CustomRow[]).map(toExercise))
      setRoutines(r.data as Routine[])
      setFolders(f.data as Folder[])
      setProfiles(p.data as Profile[])
    }
    setReady(true)
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    // Carga inicial desde Supabase (sistema externo)
    // oxlint-disable-next-line react/set-state-in-effect
    if (userId) refresh()
  }, [userId, refresh])

  const value = useMemo(() => {
    const byId = new Map<string, Exercise>()
    for (const e of library) byId.set(e.id, e)
    for (const e of custom) byId.set(e.id, e)
    return {
      ready: ready && library.length > 0,
      error,
      exercises: [...custom, ...library],
      findExercise: (id: string) => byId.get(id),
      routines,
      folders,
      profiles,
      userId: userId ?? '',
      refresh,
    }
  }, [library, custom, routines, folders, profiles, ready, error, userId, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
