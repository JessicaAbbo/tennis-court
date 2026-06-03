import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile, BlockedSlot } from '../../types'
import { formatBookingTime } from '../../lib/dateUtils'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'

interface Props { profile: Profile }

export function BlockSlotManager({ profile }: Props) {
  const [blocked, setBlocked] = useState<BlockedSlot[]>([])
  const [startDate, setStartDate] = useState('')
  const [startHour, setStartHour] = useState('8')
  const [endDate, setEndDate] = useState('')
  const [endHour, setEndHour] = useState('10')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchBlocked() }, [])

  async function fetchBlocked() {
    const { data } = await supabase
      .from('blocked_slots')
      .select('*')
      .gte('end_time', new Date().toISOString())
      .order('start_time')
    setBlocked(data ?? [])
  }

  // Build UTC from local Panama date + hour
  function toUTC(dateStr: string, hour: number): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    // Panama UTC-5
    const utcMs = Date.UTC(y, m - 1, d, hour + 5, 0, 0, 0)
    return new Date(utcMs).toISOString()
  }

  async function handleBlock() {
    if (!startDate || !endDate) { toast.error('Selecciona fechas'); return }
    setSaving(true)
    const { error } = await supabase.from('blocked_slots').insert({
      start_time: toUTC(startDate, parseInt(startHour)),
      end_time:   toUTC(endDate,   parseInt(endHour)),
      reason:     reason.trim() || null,
      created_by: profile.id,
    })
    if (error) toast.error('Error al bloquear')
    else { toast.success('Slots bloqueados'); fetchBlocked() }
    setSaving(false)
  }

  async function handleUnblock(id: string) {
    const { error } = await supabase.from('blocked_slots').delete().eq('id', id)
    if (error) toast.error('Error')
    else { toast.success('Bloqueo eliminado'); fetchBlocked() }
  }

  const hours = Array.from({ length: 17 }, (_, i) => i + 6)

  return (
    <div className="block-manager">
      <div className="block-form">
        <h3>Bloquear rango</h3>
        <div className="form-row">
          <div className="field">
            <label>Fecha inicio</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Hora inicio</label>
            <select value={startHour} onChange={e => setStartHour(e.target.value)}>
              {hours.map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Fecha fin</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Hora fin</label>
            <select value={endHour} onChange={e => setEndHour(e.target.value)}>
              {hours.map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Motivo (opcional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej. Mantenimiento de malla" />
        </div>
        <button className="btn-danger" onClick={handleBlock} disabled={saving}>
          {saving ? 'Bloqueando...' : 'Bloquear'}
        </button>
      </div>

      <div className="blocked-list">
        <h3>Slots bloqueados próximos</h3>
        {blocked.length === 0 && <p className="empty-msg">No hay slots bloqueados</p>}
        {blocked.map(b => (
          <div key={b.id} className="blocked-row">
            <div>
              <span className="blocked-range">
                {formatBookingTime(b.start_time)} → {formatBookingTime(b.end_time)}
              </span>
              {b.reason && <span className="blocked-reason"> — {b.reason}</span>}
            </div>
            <button className="icon-btn danger" onClick={() => handleUnblock(b.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
