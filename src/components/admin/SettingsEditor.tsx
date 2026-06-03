import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface Setting { key: string; value: string; description: string }

export function SettingsEditor() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').order('key').then(({ data }) => {
      if (data) { setSettings(data); setEdits(Object.fromEntries(data.map(s => [s.key, s.value]))) }
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    const updates = settings.map(s => ({ key: s.key, value: edits[s.key], description: s.description }))
    const { error } = await supabase.from('settings').upsert(updates)
    if (error) toast.error('Error al guardar')
    else toast.success('Reglas actualizadas')
    setSaving(false)
  }

  return (
    <div className="settings-editor">
      <p className="settings-intro">
        Ajusta las reglas de equidad. Los cambios aplican a nuevas reservas de inmediato.
      </p>
      <div className="settings-list">
        {settings.map(s => (
          <div key={s.key} className="setting-row">
            <div className="setting-meta">
              <span className="setting-label">{s.description}</span>
              <code className="setting-key">{s.key}</code>
            </div>
            <input
              className="setting-input"
              value={edits[s.key] ?? ''}
              onChange={e => setEdits(prev => ({ ...prev, [s.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  )
}
