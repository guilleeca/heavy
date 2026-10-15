import { toast } from '../lib/toast'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../data/context'
import {
  EQUIPMENTS,
  EQUIPMENT_LABEL,
  MUSCLES,
  MUSCLE_LABEL,
  TYPE_LABEL,
  type Equipment,
  type ExerciseType,
  type Muscle,
} from '../lib/exercises'
import { Icon } from './Icon'
import { PageHeader, Sheet, SheetItem} from './ui'
import './CustomExerciseForm.css'

/** Crear un ejercicio personalizado. Devuelve su id ("c:<uuid>") al guardar. */
export function CustomExerciseForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (id: string) => void }) {
  const { refresh } = useData()
  const [name, setName] = useState('')
  const [equipment, setEquipment] = useState<Equipment | ''>('')
  const [muscle, setMuscle] = useState<Muscle | ''>('')
  const [secondary, setSecondary] = useState<Muscle[]>([])
  const [type, setType] = useState<ExerciseType>('weight_reps')
  const [sheet, setSheet] = useState<'equipment' | 'muscle' | 'secondary' | 'type' | null>(null)
  const [saving, setSaving] = useState(false)

  const canSave = name.trim().length > 0 && equipment && muscle && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    const { data, error } = await supabase
      .from('custom_exercises')
      .insert({ name: name.trim(), equipment, muscle, secondary_muscles: secondary, exercise_type: type })
      .select('id')
      .single()
    setSaving(false)
    if (error || !data) {
      toast('No se pudo guardar el ejercicio. Inténtalo de nuevo.')
      return
    }
    await refresh()
    toast('Ejercicio creado')
    onSaved(`c:${data.id}`)
  }

  const field = (label: string, value: string, key: typeof sheet, placeholder: string) => (
    <button className="cef-field" onClick={() => setSheet(key)}>
      <span className="cef-label">{label}</span>
      <span className={value ? 'cef-value' : 'cef-placeholder'}>{value || placeholder}</span>
      <Icon name="chevronRight" size={18} />
    </button>
  )

  return (
    <div className="cef">
      <PageHeader
        title="Crear ejercicio"
        left={
          <button className="text-btn" onClick={onCancel}>
            Cancelar
          </button>
        }
        right={
          <button className="save-btn" disabled={!canSave} onClick={save}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        }
      />
      <div className="cef-body">
        <input
          id="custom-exercise-name"
          className="cef-name"
          placeholder="Nombre del ejercicio"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="cef-fields">
          {field('Equipamiento', equipment ? EQUIPMENT_LABEL[equipment] : '', 'equipment', 'Elegir')}
          {field('Músculo principal', muscle ? MUSCLE_LABEL[muscle] : '', 'muscle', 'Elegir')}
          {field('Otros músculos', secondary.map((m) => MUSCLE_LABEL[m]).join(', '), 'secondary', 'Opcional')}
          {field('Tipo de ejercicio', TYPE_LABEL[type], 'type', '')}
        </div>
      </div>

      <Sheet open={sheet === 'equipment'} onClose={() => setSheet(null)} title="Equipamiento">
        {EQUIPMENTS.map((k) => (
          <SheetItem key={k} selected={equipment === k} onClick={() => (setEquipment(k), setSheet(null))}>
            {EQUIPMENT_LABEL[k]}
          </SheetItem>
        ))}
      </Sheet>
      <Sheet open={sheet === 'muscle'} onClose={() => setSheet(null)} title="Músculo principal">
        {MUSCLES.map((k) => (
          <SheetItem key={k} selected={muscle === k} onClick={() => (setMuscle(k), setSecondary((s) => s.filter((x) => x !== k)), setSheet(null))}>
            {MUSCLE_LABEL[k]}
          </SheetItem>
        ))}
      </Sheet>
      <Sheet open={sheet === 'secondary'} onClose={() => setSheet(null)} title="Otros músculos">
        {MUSCLES.filter((k) => k !== muscle).map((k) => (
          <SheetItem
            key={k}
            selected={secondary.includes(k)}
            onClick={() => setSecondary((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
          >
            {MUSCLE_LABEL[k]}
          </SheetItem>
        ))}
        <button className="btn btn-primary btn-block" onClick={() => setSheet(null)}>
          Hecho
        </button>
      </Sheet>
      <Sheet open={sheet === 'type'} onClose={() => setSheet(null)} title="Tipo de ejercicio">
        {(Object.keys(TYPE_LABEL) as ExerciseType[]).map((k) => (
          <SheetItem key={k} selected={type === k} onClick={() => (setType(k), setSheet(null))}>
            {TYPE_LABEL[k]}
          </SheetItem>
        ))}
      </Sheet>
    </div>
  )
}
