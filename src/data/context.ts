import { createContext, useContext } from 'react'
import type { Exercise } from '../lib/exercises'
import type { Folder, Routine } from '../lib/routines'
import type { Profile } from '../auth/context'

export type DataState = {
  ready: boolean
  error: string | null
  /** Personalizados primero, luego la biblioteca */
  exercises: Exercise[]
  findExercise: (id: string) => Exercise | undefined
  routines: Routine[]
  folders: Folder[]
  profiles: Profile[]
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
  userId: '',
  refresh: async () => {},
})

export const useData = () => useContext(DataContext)
