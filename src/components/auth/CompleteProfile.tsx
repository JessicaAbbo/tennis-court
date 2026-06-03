import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

interface Props { user: User; onComplete: () => void }

export function CompleteProfile({ user, onComplete }: Props) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !unit.trim()) { setError('Todos los campos son obligatorios'); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email!, name: name.trim(), unit: unit.trim(), role: 'member' })
    if (err) { setError(err.message); setSaving(false); return }
    onComplete()
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="court-icon">🎾</span>
          <h1>Completa tu perfil</h1>
          <p>Necesitamos algunos datos para activar tu cuenta</p>
        </div>
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="field">
            <label>Nombre completo</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. María García" />
          </div>
          <div className="field">
            <label>Apartamento / Unidad</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Ej. 4B" />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
