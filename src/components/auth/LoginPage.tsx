import { useState } from 'react'
import { supabase } from '../../lib/supabase'

type Mode = 'login' | 'signup' | 'reset'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      setMessage(
        error
          ? { text: error.message, isError: true }
          : { text: 'Revisa tu correo para restablecer tu contraseña.', isError: false }
      )
      setLoading(false)
      return
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage({ text: traducirError(error.message), isError: true })
    } else {
      if (!name.trim() || !unit.trim()) {
        setMessage({ text: 'El nombre y el apartamento son obligatorios.', isError: true })
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim(), unit: unit.trim() } },
      })
      if (error) setMessage({ text: traducirError(error.message), isError: true })
      else setMessage({ text: 'Cuenta creada. Revisa tu correo para confirmarla.', isError: false })
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="court-icon">🎾</span>
          <h1>Cancha de Tenis · PH Bayshore</h1>
          <p>Reserva tu turno de forma fácil y justa</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'login'  && <h2 className="form-title">Iniciar sesión</h2>}
          {mode === 'signup' && <h2 className="form-title">Crear cuenta</h2>}
          {mode === 'reset'  && <h2 className="form-title">Recuperar contraseña</h2>}

          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              required
            />
          </div>

          {mode === 'signup' && (
            <>
              <div className="field">
                <label htmlFor="name">Nombre completo</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. María García"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="unit">Apartamento / Unidad</label>
                <input
                  id="unit"
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="Ej. 4B"
                  required
                />
              </div>
            </>
          )}

          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>
          )}

          {message && (
            <p className={message.isError ? 'error-msg' : 'success-msg'}>{message.text}</p>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? 'Cargando...'
              : mode === 'login'
              ? 'Iniciar sesión'
              : mode === 'signup'
              ? 'Registrarse'
              : 'Enviar instrucciones'}
          </button>
        </form>

        <div className="login-links">
          {mode === 'login' && (
            <>
              <button className="link-btn" onClick={() => { setMode('signup'); setMessage(null); setName(''); setUnit('') }}>
                ¿No tienes cuenta? Regístrate
              </button>
              <button className="link-btn" onClick={() => { setMode('reset'); setMessage(null) }}>
                ¿Olvidaste tu contraseña?
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button className="link-btn" onClick={() => { setMode('login'); setMessage(null) }}>
              ← Volver a iniciar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function traducirError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('Email not confirmed'))       return 'Confirma tu correo antes de iniciar sesión.'
  if (msg.includes('User already registered'))   return 'Ya existe una cuenta con este correo.'
  if (msg.includes('Password should be'))        return 'La contraseña debe tener al menos 6 caracteres.'
  return msg
}
