import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type Profile = {
  id: string
  username: string | null
  full_name: string
  avatar_url: string | null
  bio: string
}

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
}

export const AuthContext = createContext<AuthState>({ session: null, profile: null, loading: true, error: null })

export const useAuth = () => useContext(AuthContext)
