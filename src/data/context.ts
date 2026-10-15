import { createContext, useContext } from 'react'
import type { Exercise } from '../lib/exercises'
import type { Folder, Routine } from '../lib/routines'
import type { Profile } from '../auth/context'
import type { Workout } from '../lib/workouts'

/** Resumen del entreno en curso de una persona (tabla live_sessions) */
export type LiveSession = {
  user_id: string
  title: string
  started_at: string
  updated_at: string
  snapshot: {
    current?: string
    setsDone?: number
    setsTotal?: number
    volume?: number
    exercises?: { exerciseId: string; done: number; total: number; last?: string }[]
    /** Copia completa del entreno en curso (solo la usa su dueño para recuperarlo) */
    state?: unknown
  }
}

export type DataState = {
  ready: boolean
  error: string | null
  /** Personalizados primero, luego la biblioteca */
  exercises: Exercise[]
  findExercise: (id: string) => Exercise | undefined
  routines: Routine[]
  folders: Folder[]
  profiles: Profile[]
  /** Entrenos visibles (propios y públicos), del más reciente al más antiguo */
  workouts: Workout[]
  live: LiveSession[]
  userId: string
  refresh: () => Promise<void>
}

export const DataContext = createContext<DataState>({
  ready: false,
  error: null,
  exercises: [],
  findExercise: () => undefined,
  routines: [],
  folders: [],
  profiles: [],
  workouts: [],
  live: [],
  userId: '',
  refresh: async () => {},
})

export const useData = () => useContext(DataContext)
