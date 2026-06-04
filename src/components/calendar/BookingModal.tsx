import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile, Booking, WaitlistEntry, BookingRules } from '../../types'
import { formatBookingTime } from '../../lib/dateUtils'
import toast from 'react-hot-toast'

interface Props {
  slotTime: string
  currentBooking: Booking | null
  waitlistEntries: WaitlistEntry[]
  profile: Profile
  rules: BookingRules
  onClose: () => void
  onBooked: () => void
}

export function BookingModal({
  slotTime, currentBooking, waitlistEntries, profile, rules, onClose, onBooked,
}: Props) {
  const [bookingFor, setBookingFor] = useState<'self' | 'guest'>('self')
  const [guestName, setGuestName] = useState('')
  const [loading, setLoading] = useState(false)

  // Admin: book on behalf of another user
  const [targetUserId, setTargetUserId] = useState<string>(profile.id)
  const [users, setUsers] = useState<Profile[]>([])

  const isAdmin = profile.role === 'admin'
  const isMyBooking = currentBooking?.user_id === profile.id
  const isTaken = !!currentBooking && !isMyBooking
  const myWaitlistEntry = waitlistEntries.find(w => w.user_id === profile.id)
  const alreadyWaiting = !!myWaitlistEntry

  useEffect(() => {
    if (isAdmin && !currentBooking) {
      supabase
        .from('profiles')
        .select('id, name, unit, email, role, is_blocked, created_at')
        .eq('is_blocked', false)
        .order('name')
        .then(({ data }) => setUsers(data ?? []))
    }
  }, [isAdmin, currentBooking])

  async function handleBook() {
    setLoading(true)

    const isOnBehalf = isAdmin && targetUserId !== profile.id

    const { error } = isOnBehalf
      ? await supabase.rpc('admin_book_slot', {
          p_target_user_id: targetUserId,
          p_start_time:     slotTime,
          p_booking_for:    bookingFor,
          p_guest_name:     bookingFor === 'guest' ? guestName : null,
        })
      : await supabase.rpc('book_slot', {
          p_start_time:  slotTime,
          p_booking_for: bookingFor,
          p_guest_name:  bookingFor === 'guest' ? guestName : null,
        })

    if (error) {
      toast.error(error.message ?? 'Error al reservar')
      setLoading(false)
      return
    }
    toast.success('¡Reserva confirmada!')
    onBooked()
    onClose()
  }

  async function handleCancel() {
    setLoading(true)
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', currentBooking!.id)
    if (error) { toast.error('Error al cancelar'); setLoading(false); return }
    toast.success('Reserva cancelada')
    onBooked()
    onClose()
  }

  async function handleWaitlist() {
    setLoading(true)
    if (alreadyWaiting) {
      const { error } = await supabase.from('waitlist').delete().eq('id', myWaitlistEntry!.id)
      if (error) toast.error('Error')
      else { toast.success('Saliste de la lista de espera'); onBooked() }
    } else {
      const { error } = await supabase.from('waitlist').insert({ user_id: profile.id, slot_time: slotTime })
      if (error) toast.error('Error al unirse')
      else { toast.success('Te agregaste a la lista de espera'); onBooked() }
    }
    setLoading(false)
    onClose()
  }

  // Admin cancelling someone else's booking
  const canAdminCancel = isAdmin && currentBooking && !isMyBooking

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎾 {formatBookingTime(slotTime)}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {isMyBooking ? (
          <div className="modal-body">
            <p className="slot-info">
              {currentBooking.booking_for === 'guest'
                ? `Reservaste para invitado: ${currentBooking.guest_name}`
                : 'Tienes este turno reservado.'}
            </p>
            <button className="btn-danger" onClick={handleCancel} disabled={loading}>
              {loading ? 'Cancelando...' : 'Cancelar mi reserva'}
            </button>
          </div>

        ) : isTaken ? (
          <div className="modal-body">
            <p className="slot-info slot-taken">
              Reservado por <strong>{currentBooking.profile?.name ?? 'otro residente'}</strong>
              {currentBooking.booking_for === 'guest' && ` — invitado: ${currentBooking.guest_name}`}
            </p>
            {canAdminCancel && (
              <button className="btn-danger" onClick={handleCancel} disabled={loading} style={{ marginBottom: '.5rem' }}>
                {loading ? 'Cancelando...' : 'Cancelar esta reserva (admin)'}
              </button>
            )}
            <div className="waitlist-info">
              <p className="waitlist-count">
                {waitlistEntries.length > 0
                  ? `${waitlistEntries.length} persona(s) en lista de espera`
                  : 'Sin lista de espera aún'}
              </p>
              {!isAdmin && (
                <button
                  className={alreadyWaiting ? 'btn-secondary' : 'btn-primary'}
                  onClick={handleWaitlist}
                  disabled={loading}
                >
                  {alreadyWaiting ? 'Salir de la lista de espera' : 'Unirse a lista de espera'}
                </button>
              )}
            </div>
          </div>

        ) : (
          <div className="modal-body">

            {/* Admin: pick which user to book for */}
            {isAdmin && users.length > 0 && (
              <div className="field">
                <label>Reservar para</label>
                <select
                  value={targetUserId}
                  onChange={e => setTargetUserId(e.target.value)}
                >
                  <option value={profile.id}>Yo mismo ({profile.name})</option>
                  {users
                    .filter(u => u.id !== profile.id)
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} — Apt. {u.unit}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="field">
              <label>Tipo de reserva</label>
              <div className="radio-group">
                <label className={`radio-option ${bookingFor === 'self' ? 'selected' : ''}`}>
                  <input type="radio" value="self" checked={bookingFor === 'self'} onChange={() => setBookingFor('self')} />
                  Residente
                </label>
                <label className={`radio-option ${bookingFor === 'guest' ? 'selected' : ''}`}>
                  <input type="radio" value="guest" checked={bookingFor === 'guest'} onChange={() => setBookingFor('guest')} />
                  Invitado
                </label>
              </div>
            </div>

            {bookingFor === 'guest' && (
              <div className="field">
                <label>Nombre del invitado</label>
                <input
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="Nombre completo"
                  autoFocus
                />
              </div>
            )}

            <div className="rules-reminder">
              <small>
                Máx. {rules.max_active_bookings} reservas activas · Máx. {rules.max_per_day} por día ·
                Máx. {rules.prime_max_per_week} prime/semana
              </small>
            </div>

            <button className="btn-primary" onClick={handleBook} disabled={loading}>
              {loading ? 'Reservando...' : 'Confirmar reserva'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
