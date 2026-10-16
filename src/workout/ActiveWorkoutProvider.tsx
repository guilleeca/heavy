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
import { sendPush } from '../lib/push'
import { askNotificationPermission, closeWorkoutNotification, nextPending, showWorkoutNotification } from './notify'

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
  const { userId, workouts, findExercise, refresh, live, ready } = useData()
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
      return Promise.resolve(
        supabase.from('live_sessions').upsert({
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
        }),
      ).then(() => undefined)
    },
    [userId, findExercise],
  )

  // Publicar agrupando cambios seguidos…
  const liveTimer = useRef<number | undefined>(undefined)
  const latest = useRef<ActiveWorkout | null>(null)
  const finishing = useRef(false)
  useEffect(() => {
    latest.current = active
    if (!active || !userId) return
    window.clearTimeout(liveTimer.current)
    liveTimer.current = window.setTimeout(() => {
      if (finishing.current) return
      void publish(active).then(() => {
        // Aviso push al otro, una sola vez por entreno y solo al empezarlo
        let notified: string | null = null
        try {
          notified = localStorage.getItem('heavy.liveNotified')
        } catch {
          /* sin almacenamiento */
        }
        if (notified === active.id || Date.now() - active.startedAt > 10 * 60_000) return
        try {
          localStorage.setItem('heavy.liveNotified', active.id)
        } catch {
          /* sin almacenamiento */
        }
        sendPush('live', userId)
      })
    }, 1500)
    return () => window.clearTimeout(liveTimer.current)
  }, [active, userId, publish])

  // …y al instante si la app pasa a segundo plano o se cierra
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && latest.current && !finishing.current) {
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

  // Al abrir la app (una sola vez): si el móvil perdió el entreno local pero
  // hay copia en la nube, se recupera. Si esa copia es de un entreno que ya
  // se guardó, se borra.
  const cloudChecked = useRef(false)
  useEffect(() => {
    if (cloudChecked.current || !ready || !userId) return
    cloudChecked.current = true
    const mine = live.find((l) => l.user_id === userId)
    if (!mine) return
    const state = mine.snapshot.state as ActiveWorkout | undefined
    const valid = !!state?.id && Array.isArray(state.exercises)
    if (!valid || workouts.some((w) => w.id === state.id)) {
      void Promise.resolve(supabase.from('live_sessions').delete().eq('user_id', userId)).then(() => undefined)
      return
    }
    // oxlint-disable-next-line react/set-state-in-effect
    if (!active) setActive(state)
  }, [ready, live, workouts, active, userId])

  // Un entreno que ya está guardado nunca puede seguir "en curso"
  useEffect(() => {
    if (active && workouts.some((w) => w.id === active.id)) {
      // oxlint-disable-next-line react/set-state-in-effect
      setActive(null)
      void Promise.resolve(supabase.from('live_sessions').delete().eq('user_id', userId)).then(() => undefined)
    }
  }, [active, workouts, userId])

  // Pedir al navegador que no borre los datos de la app
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => {})
  }, [])

  // Aviso al terminar el descanso
  const restEndedAt = useRef(0)
  useEffect(() => {
    if (!active?.rest) return
    const ms = active.rest.endsAt - Date.now()
    const t = window.setTimeout(
      () => {
        setActive((a) => {
          if (!a) return a
          restEndedAt.current = Date.now()
          if (document.visibilityState !== 'hidden') restDoneAlert()
          return { ...a, rest: null }
        })
      },
      Math.max(0, ms),
    )
    return () => window.clearTimeout(t)
  }, [active?.rest, findExercise])

  const mutate = useCallback((fn: (a: ActiveWorkout) => ActiveWorkout) => setActive((a) => (a ? fn(a) : a)), [])
  const mutateEx = useCallback(
    (ei: number, fn: (e: LiveExercise) => LiveExercise) => mutate((a) => ({ ...a, exercises: a.exercises.map((e, i) => (i === ei ? fn(e) : e)) })),
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

  /** Marcar / desmarcar una serie (rellena valores vacíos y arranca el descanso) */
  const toggleIn = useCallback(
    (a: ActiveWorkout, ei: number, si: number): ActiveWorkout => {
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
                k === si
                  ? {
                      ...y,
                      done,
                      weight: y.weight ?? eff?.weight ?? null,
                      reps: y.reps ?? eff?.reps ?? null,
                      duration: y.duration ?? eff?.duration ?? null,
                    }
                  : y,
              ),
            }
          : x,
      )
      // Al completar una serie arranca el descanso del ejercicio
      const rest = done && e.restSeconds > 0 ? { endsAt: Date.now() + e.restSeconds * 1000, total: e.restSeconds } : done ? null : a.rest
      return { ...a, exercises, rest }
    },
    [workouts, userId],
  )

  // Notificación fija durante todo el entreno (como Hevy): así ya está puesta
  // cuando sales de la app, sin depender de que el móvil avise a tiempo.
  const notifyTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    // Recién terminado el descanso y fuera de la app: aviso con sonido y vibración
    const restDone = !!active && !active.rest && Date.now() - restEndedAt.current < 3000 && document.visibilityState === 'hidden'
    window.clearTimeout(notifyTimer.current)
    if (!active) {
      void closeWorkoutNotification()
      return
    }
    // Fuera de la app (p. ej. tras pulsar −15/+15) se actualiza al instante
    const delay = restDone || document.visibilityState === 'hidden' ? 0 : 400
    notifyTimer.current = window.setTimeout(() => void showWorkoutNotification(active, findExercise, restDone), delay)
    // Durante el descanso, la cuenta atrás de la notificación baja segundo a segundo
    const tick = active.rest
      ? window.setInterval(() => {
          if (active.rest && active.rest.endsAt > Date.now()) void showWorkoutNotification(active, findExercise)
        }, 1000)
      : undefined
    return () => {
      window.clearTimeout(notifyTimer.current)
      window.clearInterval(tick)
    }
  }, [active, findExercise])

  // Botones de la notificación (llegan desde el service worker)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (ev: MessageEvent) => {
      const msg = ev.data as { type?: string; action?: string }
      if (msg?.type !== 'heavy-action') return
      const shift = (a: ActiveWorkout, d: number): ActiveWorkout =>
        a.rest ? { ...a, rest: { endsAt: Math.max(Date.now() + 1000, a.rest.endsAt + d * 1000), total: Math.max(a.rest.total + d, 1) } } : a
      setActive((a) => {
        if (!a) return a
        switch (msg.action) {
          case 'rest-minus':
            return shift(a, -15)
          case 'rest-plus':
            return shift(a, 15)
          case 'rest-skip':
            return { ...a, rest: null }
          case 'complete': {
            const next = nextPending(a)
            return next ? toggleIn(a, next[0], next[1]) : a
          }
          default:
            return a
        }
      })
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [toggleIn])

  const api: ActiveWorkoutApi = useMemo(
    () => ({
      active,
      start: (routine?: Routine) => {
        void askNotificationPermission()
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
        window.clearTimeout(liveTimer.current)
        setActive(null)
        await supabase.from('live_sessions').delete().eq('user_id', userId)
      },
      finish: async (input: FinishInput) => {
        if (!active) return null
        finishing.current = true
        window.clearTimeout(liveTimer.current)
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
        const startedAt = input.startedAt ?? active.startedAt
        const endedAt = input.durationS != null ? startedAt + input.durationS * 1000 : Date.now()
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
          title: input.title.trim() || defaultTitle(new Date(startedAt)),
          description: input.description.trim(),
          started_at: new Date(startedAt).toISOString(),
          ended_at: new Date(endedAt).toISOString(),
          duration_s: Math.max(0, Math.round((endedAt - startedAt) / 1000)),
          volume_kg: workoutVolume(exercises, findExercise),
          sets_count: exercises.reduce((a, e) => a + e.sets.length, 0),
          exercises,
          photos,
          visibility: input.visibility,
        })
        if (error) {
          finishing.current = false
          return null
        }
        setActive(null)
        await supabase.from('live_sessions').delete().eq('user_id', userId)
        finishing.current = false
        sendPush('workout', id)
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
      toggleDone: (ei, si) => mutate((a) => toggleIn(a, ei, si)),
      adjustRest: (delta) =>
        mutate((a) => {
          if (!a.rest) return a
          const endsAt = Math.max(Date.now() + 1000, a.rest.endsAt + delta * 1000)
          return { ...a, rest: { endsAt, total: Math.max(a.rest.total + delta, 1) } }
        }),
      skipRest: () => mutate((a) => ({ ...a, rest: null })),
    }),
    [active, userId, workouts, findExercise, refresh, mutate, mutateEx, liveExercise, toggleIn],
  )

  return <ActiveWorkoutContext.Provider value={api}>{children}</ActiveWorkoutContext.Provider>
}
