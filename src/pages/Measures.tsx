import { useCallback, useEffect, useState } from 'react'
import { PageHeader, Sheet, Spinner } from '../components/ui'
import { Icon } from '../components/Icon'
import { LineChart } from '../components/LineChart'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { fmtKg } from '../lib/workouts'
import './Measures.css'

type Field = 'weight_kg' | 'body_fat' | 'chest_cm' | 'waist_cm' | 'hips_cm' | 'arm_cm' | 'thigh_cm'
type Row = { id: string; measured_on: string } & Record<Field, number | null>

const FIELDS: { key: Field; label: string; unit: string }[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg' },
  { key: 'body_fat', label: '% Grasa', unit: '%' },
  { key: 'chest_cm', label: 'Pecho', unit: 'cm' },
  { key: 'waist_cm', label: 'Cintura', unit: 'cm' },
  { key: 'hips_cm', label: 'Cadera', unit: 'cm' },
  { key: 'arm_cm', label: 'Brazo', unit: 'cm' },
  { key: 'thigh_cm', label: 'Muslo', unit: 'cm' },
]

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const fmtDay = (s: string) => parseDay(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

type Draft = { id?: string; measured_on: string; values: Partial<Record<Field, string>> }

/** Medidas corporales: peso, grasa y perímetros con su evolución */
export function Measures() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [field, setField] = useState<Field>('weight_kg')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('measurements').select('*').order('measured_on', { ascending: false })
    if (error) {
      toast('No se pudieron cargar las medidas')
      setRows([])
    } else setRows(data as Row[])
  }, [])

  useEffect(() => {
    // Carga desde Supabase (sistema externo)
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  async function save() {
    if (!draft) return
    const payload: Record<string, unknown> = { measured_on: draft.measured_on || today() }
    for (const f of FIELDS) {
      const v = draft.values[f.key]?.replace(',', '.').trim()
      payload[f.key] = v ? Number(v) : null
    }
    if (FIELDS.every((f) => payload[f.key] == null)) return toast('Escribe al menos una medida')
    if (FIELDS.some((f) => payload[f.key] != null && !Number.isFinite(payload[f.key]))) return toast('Revisa los números')
    setSaving(true)
    const { error } = draft.id
      ? await supabase.from('measurements').update(payload).eq('id', draft.id)
      : await supabase.from('measurements').insert(payload)
    setSaving(false)
    if (error) return toast('No se pudo guardar. Revisa que los valores sean razonables.')
    setDraft(null)
    await load()
  }

  async function remove() {
    if (!draft?.id) return
    const { error } = await supabase.from('measurements').delete().eq('id', draft.id)
    if (error) return toast('No se pudo borrar')
    setDraft(null)
    await load()
  }

  const edit = (r?: Row) =>
    setDraft(
      r
        ? {
            id: r.id,
            measured_on: r.measured_on,
            values: Object.fromEntries(FIELDS.map((f) => [f.key, r[f.key] != null ? String(r[f.key]).replace('.', ',') : ''])),
          }
        : { measured_on: today(), values: {} },
    )

  const fmt = (f: (typeof FIELDS)[number], v: number) => `${fmtKg(v)} ${f.unit}`
  const used = FIELDS.filter((f) => rows?.some((r) => r[f.key] != null))
  const current = FIELDS.find((f) => f.key === field)!
  const points = (rows ?? [])
    .filter((r) => r[field] != null)
    .map((r) => ({ date: parseDay(r.measured_on), value: r[field]! }))
    .reverse()

  return (
    <div className="ms">
      <PageHeader
        title="Medidas"
        right={
          <button className="header-btn" aria-label="Añadir medidas" onClick={() => edit()}>
            <Icon name="plus" />
          </button>
        }
      />
      <div className="ms-body">
        {rows == null ? (
          <Spinner />
        ) : !rows.length ? (
          <div className="empty">
            <Icon name="ruler" size={40} stroke={1.4} />
            <p>Apunta tu peso y medidas para ver cómo cambian con el tiempo.</p>
            <button className="btn btn-primary" onClick={() => edit()}>
              Añadir medidas
            </button>
          </div>
        ) : (
          <>
            <div className="ms-chips" role="group" aria-label="Medida">
              {(used.length ? used : FIELDS).map((f) => (
                <button key={f.key} aria-pressed={field === f.key} onClick={() => setField(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <section className="card">
              <LineChart points={points} format={(v) => fmt(current, v)} label={current.label} />
            </section>

            <section className="stack">
              <h2 className="section-title">Historial</h2>
              <div className="ms-list">
                {rows.map((r) => (
                  <button key={r.id} className="ms-row" onClick={() => edit(r)}>
                    <b>{fmtDay(r.measured_on)}</b>
                    <span>
                      {FIELDS.filter((f) => r[f.key] != null)
                        .map((f) => `${f.label} ${fmt(f, r[f.key]!)}`)
                        .join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Editar medidas' : 'Nuevas medidas'}>
        {draft && (
          <div className="ms-form">
            <label className="ms-field">
              <span>Fecha</span>
              <input type="date" value={draft.measured_on} max={today()} onChange={(e) => setDraft({ ...draft, measured_on: e.target.value })} />
            </label>
            {FIELDS.map((f) => (
              <label key={f.key} className="ms-field">
                <span>{f.label}</span>
                <input
                  inputMode="decimal"
                  placeholder="-"
                  value={draft.values[f.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, values: { ...draft.values, [f.key]: e.target.value.replace(/[^\d.,]/g, '') } })}
                />
                <small>{f.unit}</small>
              </label>
            ))}
            <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {draft.id && (
              <button className="btn btn-block ms-delete" onClick={remove}>
                Borrar
              </button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
