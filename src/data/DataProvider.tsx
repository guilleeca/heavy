import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { loadLibrary, type Exercise } from '../lib/exercises'
import type { Folder, Routine } from '../lib/routines'
import type { Workout } from '../lib/workouts'
import type { LiveSession } from './context'
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
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [live, setLive] = useState<LiveSession[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLibrary().then(setLibrary)
  }, [])

  const refresh = useCallback(async () => {
    const [c, r, f, p, w, l] = await Promise.all([
      supabase.from('custom_exercises').select('*').order('name'),
      supabase.from('routines').select('*').order('position').order('created_at'),
      supabase.from('routine_folders').select('*').order('position').order('created_at'),
      supabase.from('profiles').select('id, username, full_name, avatar_url, bio'),
      supabase.from('workouts').select('*').order('started_at', { ascending: false }).limit(1000),
      supabase.from('live_sessions').select('*'),
    ])
    const err = c.error || r.error || f.error || p.error || w.error || l.error
    if (err) {
      setError('No se pudieron cargar tus datos. Revisa la conexión.')
    } else {
      setError(null)
      setCustom((c.data as CustomRow[]).map(toExercise))
      setRoutines(r.data as Routine[])
      setFolders(f.data as Folder[])
      setProfiles(p.data as Profile[])
      setWorkouts(w.data as Workout[])
      setLive(l.data as LiveSession[])
    }
    setReady(true)
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    // Carga inicial desde Supabase (sistema externo)
    // oxlint-disable-next-line react/set-state-in-effect
    if (userId) refresh()
  }, [userId, refresh])

  // Entrenos en directo: avisos en tiempo real de Supabase
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('live-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, (payload) => {
        setLive((list) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<LiveSession>
            return list.filter((x) => x.user_id !== old.user_id)
          }
          const row = payload.new as LiveSession
          return [...list.filter((x) => x.user_id !== row.user_id), row]
        })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

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
      workouts,
      live,
      userId: userId ?? '',
      refresh,
    }
  }, [library, custom, routines, folders, profiles, workouts, live, ready, error, userId, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
