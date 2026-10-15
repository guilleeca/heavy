/* Biblioteca de ejercicios: datos de ExerciseDB (API gratuita) con nombres en español
   al estilo de Hevy, más los ejercicios personalizados de cada usuario (Supabase). */

export type Muscle =
  | 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'abdominals' | 'quadriceps' | 'hamstrings'
  | 'glutes' | 'calves' | 'lats' | 'upper_back' | 'lower_back' | 'traps' | 'neck' | 'abductors' | 'adductors'
  | 'cardio' | 'full_body'

export type Equipment = 'none' | 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'band' | 'cardio_machine' | 'other'

/** Cómo se registra cada serie */
export type ExerciseType = 'weight_reps' | 'reps' | 'assisted' | 'duration'

export type Exercise = {
  id: string
  name: string
  nameEn?: string
  equipment: Equipment
  muscle: Muscle
  secondary: Muscle[]
  type: ExerciseType
  custom?: boolean
  userId?: string
  /** Hay otro ejercicio con el mismo nombre en español: se muestra el original */
  ambiguous?: boolean
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  abdominals: 'Abdominales', abductors: 'Abductores', adductors: 'Aductores', biceps: 'Bíceps', calves: 'Gemelos',
  cardio: 'Cardio', chest: 'Pecho', forearms: 'Antebrazos', full_body: 'Cuerpo completo', glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales', lats: 'Dorsales', lower_back: 'Espalda baja', neck: 'Cuello', quadriceps: 'Cuádriceps',
  shoulders: 'Hombros', traps: 'Trapecio', triceps: 'Tríceps', upper_back: 'Espalda alta',
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  none: 'Ninguno', barbell: 'Barra', dumbbell: 'Mancuerna', kettlebell: 'Kettlebell', machine: 'Máquina',
  cable: 'Polea', band: 'Banda elástica', cardio_machine: 'Máquina de cardio', other: 'Otro',
}

export const TYPE_LABEL: Record<ExerciseType, string> = {
  weight_reps: 'Peso y repeticiones',
  reps: 'Peso corporal (repeticiones)',
  assisted: 'Peso corporal asistido',
  duration: 'Duración',
}

export const MUSCLES = (Object.keys(MUSCLE_LABEL) as Muscle[]).sort((a, b) => MUSCLE_LABEL[a].localeCompare(MUSCLE_LABEL[b], 'es'))
export const EQUIPMENTS = Object.keys(EQUIPMENT_LABEL) as Equipment[]

/** Animación del ejercicio (ExerciseDB). Los personalizados no tienen. */
export const gifUrl = (ex: Exercise) => (ex.custom ? null : `https://static.exercisedb.dev/media/${ex.id}.gif`)

type Raw = { id: string; n: string; en: string; eq: Equipment; m: Muscle; s: Muscle[]; t: ExerciseType; d?: 1 }

let library: Exercise[] | null = null
let loading: Promise<Exercise[]> | null = null

/** Carga la biblioteca (archivo aparte para no hacer pesada la primera carga). */
export function loadLibrary(): Promise<Exercise[]> {
  if (library) return Promise.resolve(library)
  loading ??= import('../data/exercises.json').then((mod) => {
    const raw = mod.default as Raw[]
    library = raw.map((r) => ({ id: r.id, name: r.n, nameEn: r.en, equipment: r.eq, muscle: r.m, secondary: r.s, type: r.t, ambiguous: r.d === 1 }))
    return library
  })
  return loading
}

export function getLoadedLibrary() {
  return library
}

/** Normaliza para buscar sin tildes ni mayúsculas */
export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function searchExercises(all: Exercise[], q: string, muscle: Muscle | '', equipment: Equipment | '') {
  const terms = fold(q).split(/\s+/).filter(Boolean)
  return all.filter((e) => {
    if (muscle && e.muscle !== muscle) return false
    if (equipment && e.equipment !== equipment) return false
    if (!terms.length) return true
    const hay = fold(`${e.name} ${e.nameEn ?? ''} ${MUSCLE_LABEL[e.muscle]}`)
    return terms.every((t) => hay.includes(t))
  })
}
