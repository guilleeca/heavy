/* Importar el historial exportado de Hevy (Perfil → Ajustes → Exportar entrenamientos → CSV).
   Cada fila del CSV es una serie; se agrupan por entreno (hora de inicio) y por ejercicio. */

import { fold, type Equipment, type Exercise, type ExerciseType, type Muscle } from './exercises'
import type { SetType } from './routines'
import type { WorkoutExercise, WorkoutSet } from './workouts'

/** Ejercicios de Hevy → ejercicio de la biblioteca (ExerciseDB). Clave: nombre normalizado. */
const LIBRARY_MAP: Record<string, string> = {
  'press de banca (maquina smith)': 'trqKQv2',
  'dominada (asistida)': '5ipN0iE',
  'curl martillo (cable)': 'HPlPoQA',
  'press de banca inclinado (mancuerna)': 'B3Rxp6L',
  'jalon al pecho (cable)': 'LEprlgG',
  'press frances (barra)': '1TVoin7',
  'press de piernas': '10Z2DXU',
  'elevacion laterales (mancuerna)': 'DsgkuIt',
  'elevacion lateral (mancuerna)': 'DsgkuIt',
  'tiron a la cara': 'wqNPGCg',
  'extension de triceps a un brazo (cable)': 'qU8bYp7',
  'press de hombros (mancuerna)': 'znQUdHY',
  'remo inclinado (barra)': 'eZyBC3j',
  'press de banca inclinado (maquina smith)': '5v7KYld',
  'rueda abdominal': 'NAgVB3t',
  'zancada (mancuerna)': 'RRWFUcw',
  'curl con barra ez': '6TG6x2w',
  'sentadilla (maquina smith)': 'jFtipLl',
  'press militar de pie (barra)': 'Kyd9Rz5',
  'triceps con polea': '3ZflifB',
  'aperturas (mancuerna)': 'yz9nUhF',
  'remo sentado con cable': 'A3P4O0R',
  'press de pecho (maquina)': 'DOoWcnA',
  'peso muerto rumano (barra)': 'o6LqKKP',
  'abdominal corto con cable': 'CUmLRTA',
  'elevacion lateral a un brazo (cable)': 'myJeTAe',
  'curl arana (barra)': '2kattbR',
  'extension de pierna': 'my33uHU',
  'press de banca (mancuerna)': 'SpYC0Kp',
  'fondos': '9WTm7dq',
  'press de pantorrilla (maquina)': '7B4F5nZ',
  'russian twist (con peso anadido)': 'fZFZ704',
  'jalon al pecho a un brazo': 'U5INZY6',
  'curl de biceps (mancuerna)': 'NbVPDMW',
  'curl de biceps inclinado (mancuerna)': 'ae9UoXQ',
  'remo sentado con cable - agarre abierto': 'qcY50ZD',
  'remo a un brazo (cable)': 'vpp9Ku2',
  'curl de piernas acostado (maquina)': '17lJ1kr',
  'press de banca (barra)': 'EIeI8Vf',
  'remo con mancuerna': 'C0MA9bC',
  'curls de concentracion': 'gvsWLQw',
  'patada de triceps': 'bQy2Eni',
  'remo sentado con agarre en v (cable)': 'Tq6gbK6',
  'remo en base rotativa': 'w2oRpuH',
  'extension de triceps (cable)': '2IxROQ1',
  'pull over unilateral polea': 'x69MAlq',
  'press pallof con cable': '9pa4H5m',
  'cable core palloff press': '9pa4H5m',
  'jalon de remo a un brazo': 'WrYPP2g',
  'pullover (maquina)': '4U7iLb5',
  'zancada curtsy (mancuerna)': 'gUjqdei',
}

/** Nombres distintos en Hevy que son el mismo ejercicio personalizado */
const SAME_AS: Record<string, string> = {
  'behind the back curl (cable)': 'Curl por detrás de la espalda (Polea)',
  'curl por detras de la espalda (polea)': 'Curl por detrás de la espalda (Polea)',
}

const key = (s: string) => fold(s).replace(/\s+/g, ' ').trim()

/* ---------- CSV ---------- */

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const endRow = () => {
    row.push(cell)
    rows.push(row)
    row = []
    cell = ''
  }
  const t = text.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      endRow()
    } else cell += c
  }
  if (cell || row.length) endRow()
  const [head, ...body] = rows
  if (!head) return []
  return body.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])))
}

const MONTHS: Record<string, number> = {
  ene: 0, jan: 0, feb: 1, mar: 2, abr: 3, apr: 3, may: 4, jun: 5, jul: 6, ago: 7, aug: 7,
  sep: 8, set: 8, oct: 9, nov: 10, dic: 11, dec: 11,
}

/** "14 oct 2026, 10:56" (o "Oct 14, 2026, 10:56" en inglés) → fecha local */
export function parseHevyDate(s: string): Date | null {
  const m = s.match(/(\d{1,2})\s+([a-zA-Zé.]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/)
  const en = s.match(/([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/)
  let d: Date | null = null
  if (m) {
    const mo = MONTHS[fold(m[2]).replace('.', '').slice(0, 3)]
    if (mo != null) d = new Date(+m[3], mo, +m[1], +m[4], +m[5])
  } else if (en) {
    const mo = MONTHS[en[1].toLowerCase().slice(0, 3)]
    if (mo != null) d = new Date(+en[3], mo, +en[2], +en[4], +en[5])
  } else {
    const iso = new Date(s)
    if (!isNaN(iso.getTime())) d = iso
  }
  return d && !isNaN(d.getTime()) ? d : null
}

/* ---------- ejercicios personalizados (los que no están en la biblioteca) ---------- */

export type NewCustom = { ref: string; name: string; equipment: Equipment; muscle: Muscle; type: ExerciseType }

function guessEquipment(n: string): Equipment {
  if (/smith|maquina|machine|prensa|press de piernas/.test(n)) return 'machine'
  if (/mancuerna|dumbbell/.test(n)) return 'dumbbell'
  if (/barra|barbell|landmine|ez/.test(n)) return 'barbell'
  if (/polea|cable|jalon|pulldown/.test(n)) return 'cable'
  if (/banda|band/.test(n)) return 'band'
  if (/kettlebell|pesa rusa/.test(n)) return 'kettlebell'
  if (/rotativa|pullover/.test(n)) return 'machine'
  return 'other'
}

function guessMuscle(n: string): Muscle {
  const rules: [RegExp, Muscle][] = [
    [/pierna.*curl|curl.*pierna|leg curl|femoral|rumano|romanian|peso muerto|deadlift/, 'hamstrings'],
    [/curl|bicep/, 'biceps'],
    [/tricep|frances|patada|kickback|fondos|dip/, 'triceps'],
    [/pantorrilla|gemelo|calf/, 'calves'],
    [/abdominal|crunch|pallof|plancha|plank|twist|rueda|core/, 'abdominals'],
    [/gluteo|hip thrust|curtsy|patada de gluteo/, 'glutes'],
    [/sentadilla|squat|zancada|lunge|prensa|leg press|extension de pierna|leg extension/, 'quadriceps'],
    [/banca|bench|pecho|chest|apertura|fly|cruce/, 'chest'],
    [/hombro|lateral|militar|shoulder|landmine|face pull|tiron a la cara|arnold/, 'shoulders'],
    [/jalon|pulldown|dominada|pull.?up|pull ?over|dorsal/, 'lats'],
    [/remo|row/, 'upper_back'],
    [/encogimiento|shrug|trapecio/, 'traps'],
  ]
  return rules.find(([r]) => r.test(n))?.[1] ?? 'full_body'
}

/* ---------- plan de importación ---------- */

export type ImportWorkout = {
  startedAt: Date
  endedAt: Date
  title: string
  description: string
  /** exerciseId puede ser "new:<nombre>" mientras no exista el ejercicio personalizado */
  exercises: WorkoutExercise[]
}

export type ExerciseMatch = { hevyName: string; sets: number; target: { kind: 'library' | 'custom'; exercise: Exercise } | { kind: 'new'; custom: NewCustom } }

export type ImportPlan = {
  workouts: ImportWorkout[]
  /** Entrenos que ya estaban (misma hora de inicio): no se vuelven a importar */
  duplicates: number
  matches: ExerciseMatch[]
  newCustoms: NewCustom[]
}

const SET_TYPE: Record<string, SetType> = { normal: 'normal', warmup: 'warmup', dropset: 'drop', failure: 'failure' }
const num = (s: string) => (s === '' || s == null ? null : Number(s.replace(',', '.')))

export function buildPlan(
  rows: Record<string, string>[],
  library: Exercise[],
  myCustoms: Exercise[],
  existingStarts: number[],
): ImportPlan {
  if (!rows.length || !('exercise_title' in rows[0]) || !('start_time' in rows[0])) {
    throw new Error('Este archivo no parece una exportación de entrenos de Hevy.')
  }
  const libById = new Map(library.map((e) => [e.id, e]))
  const libByName = new Map<string, Exercise>()
  for (const e of library) {
    if (!libByName.has(key(e.name))) libByName.set(key(e.name), e)
    if (e.nameEn && !libByName.has(key(e.nameEn))) libByName.set(key(e.nameEn), e)
  }
  const customByName = new Map(myCustoms.map((e) => [key(e.name), e]))

  // Cómo se registró cada ejercicio (para decidir el tipo de un personalizado nuevo)
  const stats = new Map<string, { sets: number; weight: number; reps: number; duration: number }>()
  for (const r of rows) {
    const st = stats.get(r.exercise_title) ?? { sets: 0, weight: 0, reps: 0, duration: 0 }
    st.sets++
    if (num(r.weight_kg)) st.weight++
    if (num(r.reps)) st.reps++
    if (num(r.duration_seconds)) st.duration++
    stats.set(r.exercise_title, st)
  }

  const resolved = new Map<string, string>() // nombre Hevy → exerciseId
  const matches: ExerciseMatch[] = []
  const newCustoms = new Map<string, NewCustom>()
  for (const [hevyName, st] of stats) {
    const k = key(hevyName)
    const lib = libById.get(LIBRARY_MAP[k] ?? '') ?? (SAME_AS[k] ? undefined : libByName.get(k))
    const customName = SAME_AS[k] ?? hevyName.replace(/\s+/g, ' ').trim()
    const mine = customByName.get(key(customName))
    if (lib) {
      resolved.set(hevyName, lib.id)
      matches.push({ hevyName, sets: st.sets, target: { kind: 'library', exercise: lib } })
    } else if (mine) {
      resolved.set(hevyName, mine.id)
      matches.push({ hevyName, sets: st.sets, target: { kind: 'custom', exercise: mine } })
    } else {
      const n = key(customName)
      const custom = newCustoms.get(key(customName)) ?? {
        ref: `new:${key(customName)}`,
        name: customName,
        equipment: guessEquipment(n),
        muscle: guessMuscle(n),
        type: /asistid|assisted/.test(n)
          ? 'assisted'
          : st.duration && !st.reps
            ? 'duration'
            : !st.weight && st.reps
              ? 'reps'
              : 'weight_reps',
      }
      newCustoms.set(key(customName), custom)
      resolved.set(hevyName, custom.ref)
      matches.push({ hevyName, sets: st.sets, target: { kind: 'new', custom } })
    }
  }

  // Agrupar series → entrenos → ejercicios (respetando el orden del CSV)
  const byWorkout = new Map<string, Record<string, string>[]>()
  for (const r of rows) {
    const list = byWorkout.get(r.start_time) ?? []
    list.push(r)
    byWorkout.set(r.start_time, list)
  }
  const existing = existingStarts.map((t) => Math.floor(t / 60000))
  let duplicates = 0
  const workouts: ImportWorkout[] = []
  for (const list of byWorkout.values()) {
    const first = list[0]
    const startedAt = parseHevyDate(first.start_time)
    if (!startedAt) continue
    const endedAt = parseHevyDate(first.end_time) ?? startedAt
    if (existing.includes(Math.floor(startedAt.getTime() / 60000))) {
      duplicates++
      continue
    }
    const exercises: WorkoutExercise[] = []
    let current: WorkoutExercise | null = null
    let lastTitle = ''
    for (const r of list) {
      // Un ejercicio nuevo empieza cuando cambia el nombre o se reinicia el índice de serie
      if (!current || r.exercise_title !== lastTitle || r.set_index === '0') {
        current = { exerciseId: resolved.get(r.exercise_title)!, notes: r.exercise_notes ?? '', sets: [] }
        exercises.push(current)
        lastTitle = r.exercise_title
      }
      const set: WorkoutSet = {
        type: SET_TYPE[r.set_type] ?? 'normal',
        weight: num(r.weight_kg),
        reps: num(r.reps),
        duration: num(r.duration_seconds),
      }
      current.sets.push(set)
    }
    workouts.push({
      startedAt,
      endedAt: endedAt < startedAt ? startedAt : endedAt,
      title: first.title?.trim() || 'Entreno',
      description: first.description ?? '',
      exercises,
    })
  }
  workouts.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
  matches.sort((a, b) => b.sets - a.sets)
  return { workouts, duplicates, matches, newCustoms: [...newCustoms.values()] }
}
