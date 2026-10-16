import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { SavedRoute } from '../lib/gpx'

/** Biblioteca de rutas (las de los dos), con recarga */
export function useRoutes() {
  const [routes, setRoutes] = useState<SavedRoute[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('saved_routes').select('*').order('created_at', { ascending: false })
    if (error) {
      setError(error.message.includes('saved_routes') ? 'Falta ejecutar 009_rutas_guardadas.sql en Supabase' : 'No se pudieron cargar las rutas')
      setRoutes([])
    } else {
      setError(null)
      setRoutes(data as SavedRoute[])
    }
  }, [])

  useEffect(() => {
    // Carga desde Supabase (sistema externo)
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  return { routes, error, reload: load }
}
