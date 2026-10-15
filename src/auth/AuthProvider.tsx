import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type Profile } from './context'

/** Mantiene la sesión y el perfil del usuario disponibles para toda la app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loadedProfile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(() => readAuthError())

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) setError(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Cargar el perfil cuando hay sesión
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, bio')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setProfile(data)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // El perfil cargado solo vale si es del usuario con sesión actual
  const profile = loadedProfile?.id === userId ? loadedProfile : null

  // Quitar "?code=..." de la barra de direcciones tras volver de Google
  useEffect(() => {
    if (session && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
  }, [session])

  return <AuthContext.Provider value={{ session, profile, loading, error }}>{children}</AuthContext.Provider>
}

/** Si Google o Supabase rechazan el acceso, el motivo llega en la URL. */
function readAuthError(): string | null {
  const params = new URLSearchParams(window.location.search)
  const desc = params.get('error_description')
  if (!desc) return null
  window.history.replaceState(null, '', window.location.pathname)
  if (/no tiene acceso|Database error saving new user/i.test(desc)) {
    return 'Esta cuenta de Google no tiene acceso a Heavy.'
  }
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}
