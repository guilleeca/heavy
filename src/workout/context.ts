import { createContext, useContext } from 'react'
import type { Routine } from '../lib/routines'
import type { SetType } from '../lib/routines'
import type { ActiveWorkout, LiveSet } from '../lib/workouts'

export type FinishInput = {
  title: string
  description: string
  visibility: 'everyone' | 'private'
  photos: File[]
  /** Hora de inicio y duración corregidas a mano (si no, las reales) */
  startedAt?: number
  durationS?: number
}

export type ActiveWorkoutApi = {
  active: ActiveWorkout | null
  start: (routine?: Routine) => void
  discard: () => Promise<void>
  finish: (input: FinishInput) => Promise<string | null>
  setTitle: (title: string) => void
  addExercises: (ids: string[]) => void
  replaceExercise: (ei: number, exerciseId: string) => void
  removeExercise: (ei: number) => void
  moveExercise: (ei: number, dir: -1 | 1) => void
  setNotes: (ei: number, notes: string) => void
  setRestSeconds: (ei: number, s: number) => void
  addSet: (ei: number) => void
  removeSet: (ei: number, si: number) => void
  setSetType: (ei: number, si: number, type: SetType) => void
  updateSet: (ei: number, si: number, patch: Partial<Pick<LiveSet, 'weight' | 'reps' | 'duration'>>) => void
  toggleDone: (ei: number, si: number) => void
  adjustRest: (deltaSeconds: number) => void
  skipRest: () => void
}

export const ActiveWorkoutContext = createContext<ActiveWorkoutApi | null>(null)

export function useActiveWorkout() {
  const ctx = useContext(ActiveWorkoutContext)
  if (!ctx) throw new Error('useActiveWorkout fuera de ActiveWorkoutProvider')
  return ctx
}
