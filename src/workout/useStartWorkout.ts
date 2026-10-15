import { useNavigate } from 'react-router'
import type { Routine } from '../lib/routines'
import { toast } from '../lib/toast'
import { useActiveWorkout } from './context'

/** Empieza un entreno (vacío o desde una rutina) y abre la pantalla de registro */
export function useStartWorkout() {
  const navigate = useNavigate()
  const { active, start } = useActiveWorkout()
  return (routine?: Routine) => {
    if (active) {
      toast('Ya tienes un entreno en curso: termínalo o descártalo primero')
    } else {
      start(routine)
    }
    navigate('/entreno')
  }
}
