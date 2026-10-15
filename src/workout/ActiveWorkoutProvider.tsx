import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useData } from '../data/context'
import { supabase } from '../lib/supabase'
import type { Routine } from '../lib/routines'
import {
  defaultTitle,
  effective,
  previousSets,
  uid,
  workoutVolume,
  type ActiveWorkout,
  type LiveExercise,
  type LiveSet,
  type WorkoutExercise,
} from '../lib/workouts'
import { ActiveWorkoutContext, type ActiveWorkoutApi, type FinishInput } from './context'
import { restDoneAlert } from './feedback'

const storageKey = (userId: string) => `heavy.active.${userId}`

function load(userId: string): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as ActiveWorkout) : null
  } catch {
    return null
  }
}

const emptySet = (prev?: LiveSet): LiveSet => ({
  key: uid(),
  type: prev && prev.type !== 'warmup' ? prev.type : 'normal',
  weight: null,
  reps: null,
  duration: null,
  done: false,
  target: prev?.target,
})

/** Guarda el entreno en curso en el móvil y lo publica "en directo" para el otro. */
export function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  const { userId, workouts, findExercise, refresh, live } = useData()
  const [active, setActive] = useState<ActiveWorkout | null>(() => (userId ? load(userId) : null))

  // Guardar en el móvil en cada cambio
  useEffect(() => {
    if (!userId) return
    try {
      if (active) localStorage.setItem(storageKey(userId), JSON.stringify(active))
      else localStorage.removeItem(storageKey(userId))
    } catch {
      /* sin almacenamiento */
    }
  }, [active, userId])

  // Copia en la nube del entreno en curso: alimenta el "en directo" del otro
  // y permite recuperarlo si el móvil borra los datos locales.
  const publish = useCallback(
    (a: ActiveWorkout) => {
      const exercises = a.exercises.map((e) => {
        const done = e.sets.filter((s) => s.done)
        const last = done.at(-1)
        return {
          exerciseId: e.exerciseId,
          done: done.length,
          total: e.sets.length,
          last: last ? `${last.weight ?? 0} kg × ${last.reps ?? 0}` : undefined,
        }
      })
      const current = a.exercises.find((e) => e.sets.some((s) => !s.done)) ?? a.exercises.at(-1)
      // Las consultas de Supabase solo se envían al hacer .then()/await
      return Promise.resolve(supabase.from('live_sessions').upsert({
        user_id: userId,
        title: a.title,
        started_at: new Date(a.startedAt).toISOString(),
        updated_at: new Date().toISOString(),
        snapshot: {
          current: current?.exerciseId,
          setsDone: a.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0),
          setsTotal: a.exercises.reduce((n, e) => n + e.sets.length, 0),
          volume: workoutVolume(
            a.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((x) => x.done) })),
            findExercise,
          ),
          exercises,
          state: a,
        },
      })).then(() => undefined)
    },
    [userId, findExercise],
  )

  // Publicar agrupando cambios seguidos…
  const liveTimer = useRef<number | undefined>(undefined)
  const latest = useRef<ActiveWorkout | null>(null)
  useEffect(() => {
    latest.current = active
    if (!active || !userId) return
    window.clearTimeout(liveTimer.current)
    liveTimer.current = window.setTimeout(() => void publish(active), 1500)
    return () => window.clearTimeout(liveTimer.current)
  }, [active, userId, publish])

  // …y al instante si la app pasa a segundo plano o se cierra
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && latest.current) {
        window.clearTimeout(liveTimer.current)
        void publish(latest.current)
      }
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [publish])

  // Si el móvil perdió el entreno local pero hay copia en la nube, se recupera
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || active || !userId) return
    const mine = live.find((l) => l.user_id === userId)
    const state = mine?.snapshot.state as ActiveWorkout | undefined
    if (state?.id && Array.isArray(state.exercises)) {
      restored.current = true
      // oxlint-disable-next-line react/set-state-in-effect
      setActive(state)
    }
  }, [live, active, userId])

  // Pedir al navegador que no borre los datos de la app
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => {})
  }, [])

  // Aviso al terminar el descanso
  useEffect(() => {
    if (!active?.rest) return
    const ms = active.rest.endsAt - Date.now()
    const t = window.setTimeout(
      () => {
        restDoneAlert()
        setActive((a) => (a ? { ...a, rest: null } : a))
      },
      Math.max(0, ms),
    )
    return () => window.clearTimeout(t)
  }, [active?.rest])

  const mutate = useCallback((fn: (a: ActiveWorkout) => ActiveWorkout) => setActive((a) => (a ? fn(a) : a)), [])
  const mutateEx = useCallback(
    (ei: number, fn: (e: LiveExercise) => LiveExercise) =>
      mutate((a) => ({ ...a, exercises: a.exercises.map((e, i) => (i === ei ? fn(e) : e)) })),
    [mutate],
  )

  const liveExercise = useCallback(
    (exerciseId: string, rest = 90): LiveExercise => {
      const prev = previousSets(workouts, userId, exerciseId)
      const n = Math.max(1, prev.length)
      return {
        key: uid(),
        exerciseId,
        notes: '',
        restSeconds: rest,
        sets: Array.from({ length: n }, (_, i) => ({ ...emptySet(), type: prev[i]?.type ?? 'normal' })),
      }
    },
    [workouts, userId],
  )

  const api: ActiveWorkoutApi = useMemo(
    () => ({
      active,
      start: (routine?: Routine) => {
        const id = uid()
        try {
          sessionStorage.setItem('heavy.resumed', id)
        } catch {
          /* sin almacenamiento */
        }
        setActive({
          id,
          title: routine?.title ?? defaultTitle(),
          routineId: routine?.id ?? null,
          startedAt: Date.now(),
          rest: null,
          exercises: (routine?.exercises ?? []).map((re) => ({
            key: uid(),
            exerciseId: re.exerciseId,
            notes: re.notes,
            restSeconds: re.restSeconds,
            sets: re.sets.map((s) => ({
              key: uid(),
              type: s.type,
              weight: null,
              reps: null,
              duration: null,
              done: false,
              target: { weight: s.weight, reps: s.reps, repsMax: s.repsMax, duration: s.duration },
            })),
          })),
        })
      },
      discard: async () => {
        setActive(null)
        await supabase.from('live_sessions').delete().eq('user_id', userId)
      },
      finish: async (input: FinishInput) => {
        if (!active) return null
        // Solo se guardan las series marcadas como hechas
        const exercises: WorkoutExercise[] = active.exercises
          .map((e) => {
            const prev = previousSets(workouts, userId, e.exerciseId)
            return {
              exerciseId: e.exerciseId,
              notes: e.notes,
              sets: e.sets
                .map((s, i) => ({ s, eff: effective(s, prev[i]) }))
                .filter(({ s }) => s.done)
                .map(({ s, eff }) => ({ type: s.type, ...eff })),
            }
          })
          .filter((e) => e.sets.length > 0)
        const endedAt = Date.now()
        const id = active.id
        // Fotos: se suben primero a Storage
        const photos: string[] = []
        for (const f of input.photos.slice(0, 6)) {
          const ext = (f.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
          const path = `${userId}/${id}/${uid()}.${ext}`
          const up = await supabase.storage.from('workout-photos').upload(path, f, { contentType: f.type })
          if (!up.error) photos.push(path)
        }
        const { error } = await supabase.from('workouts').insert({
          id,
          routine_id: active.routineId,
          title: input.title.trim() || defaultTitle(new Date(active.startedAt)),
          description: input.description.trim(),
          started_at: new Date(active.startedAt).toISOString(),
          ended_at: new Date(endedAt).toISOString(),
          duration_s: Math.round((endedAt - active.startedAt) / 1000),
          volume_kg: workoutVolume(exercises, findExercise),
          sets_count: exercises.reduce((a, e) => a + e.sets.length, 0),
          exercises,
          photos,
          visibility: input.visibility,
        })
        if (error) return null
        await supabase.from('live_sessions').delete().eq('user_id', userId)
        setActive(null)
        await refresh()
        return id
      },
      setTitle: (title) => mutate((a) => ({ ...a, title })),
      addExercises: (ids) => mutate((a) => ({ ...a, exercises: [...a.exercises, ...ids.map((x) => liveExercise(x))] })),
      replaceExercise: (ei, exerciseId) => mutateEx(ei, (e) => ({ ...liveExercise(exerciseId, e.restSeconds), key: e.key })),
      removeExercise: (ei) => mutate((a) => ({ ...a, exercises: a.exercises.filter((_, i) => i !== ei) })),
      moveExercise: (ei, dir) =>
        mutate((a) => {
          const list = [...a.exercises]
          const j = ei + dir
          if (j < 0 || j >= list.length) return a
          ;[list[ei], list[j]] = [list[j], list[ei]]
          return { ...a, exercises: list }
        }),
      setNotes: (ei, notes) => mutateEx(ei, (e) => ({ ...e, notes })),
      setRestSeconds: (ei, s) => mutateEx(ei, (e) => ({ ...e, restSeconds: s })),
      addSet: (ei) => mutateEx(ei, (e) => ({ ...e, sets: [...e.sets, emptySet(e.sets.at(-1))] })),
      removeSet: (ei, si) => mutateEx(ei, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== si) })),
      setSetType: (ei, si, type) => mutateEx(ei, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, type } : s)) })),
      updateSet: (ei, si, patch) => mutateEx(ei, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)) })),
      toggleDone: (ei, si) =>
        mutate((a) => {
          const e = a.exercises[ei]
          const s = e.sets[si]
          const done = !s.done
          // Si la serie se marca sin escribir nada, se rellenan con lo de la vez anterior / la rutina
          const eff = done ? effective(s, previousSets(workouts, userId, e.exerciseId)[si]) : null
          const exercises = a.exercises.map((x, i) =>
            i === ei
              ? {
                  ...x,
                  sets: x.sets.map((y, k) =>
                    k === si ? { ...y, done, weight: y.weight ?? eff?.weight ?? null, reps: y.reps ?? eff?.reps ?? null, duration: y.duration ?? eff?.duration ?? null } : y,
                  ),
                }
              : x,
          )
          // Al completar una serie arranca el descanso del ejercicio
          const rest = done && e.restSeconds > 0 ? { endsAt: Date.now() + e.restSeconds * 1000, total: e.restSeconds } : done ? null : a.rest
          return { ...a, exercises, rest }
        }),
      adjustRest: (delta) =>
        mutate((a) => {
          if (!a.rest) return a
          const endsAt = Math.max(Date.now() + 1000, a.rest.endsAt + delta * 1000)
          return { ...a, rest: { endsAt, total: Math.max(a.rest.total + delta, 1) } }
        }),
      skipRest: () => mutate((a) => ({ ...a, rest: null })),
    }),
    [active, userId, workouts, findExercise, refresh, mutate, mutateEx, liveExercise],
  )

  return <ActiveWorkoutContext.Provider value={api}>{children}</ActiveWorkoutContext.Provider>
}
