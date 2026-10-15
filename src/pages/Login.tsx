import { useState } from 'react'
import { appUrl, supabase } from '../lib/supabase'
import { useAuth } from '../auth/context'
import './Login.css'

/** Pantalla de entrada: solo "Continuar con Google". */
export function Login() {
  const { error } = useAuth()
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function signIn() {
    setBusy(true)
    setLocalError(null)
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: appUrl(), queryParams: { prompt: 'select_account' } },
    })
    if (e) {
      setLocalError('No se pudo conectar con Google. Revisa tu conexión.')
      setBusy(false)
    }
  }

  const message = localError || error
  return (
    <div className="login">
      <div className="login-brand">
        <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" width={84} height={84} />
        <h1>Heavy</h1>
        <p>Tus entrenos, carreras y rutas.</p>
      </div>
      <div className="login-actions">
        {message && <p className="login-error" role="alert">{message}</p>}
        <button className="login-google" onClick={signIn} disabled={busy}>
          <GoogleMark />
          {busy ? 'Abriendo Google…' : 'Continuar con Google'}
        </button>
        <p className="login-note">Acceso solo para cuentas invitadas.</p>
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
