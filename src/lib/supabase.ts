import { createClient } from '@supabase/supabase-js'

// Datos públicos del proyecto de Supabase. Es seguro que estén en el código:
// la protección real son las reglas (RLS) de la base de datos.
// NUNCA pongas aquí la "secret key" ni la "service_role".
const SUPABASE_URL = 'https://tmjxcxreubogfimzqqty.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kTBvbht19yHJ_eCvp2uMaA_xNJN4apI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // PKCE devuelve "?code=..." en la URL en vez de tokens en el "#",
    // que es donde viven nuestras rutas (HashRouter).
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Dirección a la que vuelve Google tras iniciar sesión (local o GitHub Pages). */
export const appUrl = () => window.location.origin + import.meta.env.BASE_URL
