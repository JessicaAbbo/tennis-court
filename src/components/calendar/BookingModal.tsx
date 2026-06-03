import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile, Booking, WaitlistEntry, BookingRules } from '../../types'
import { formatBookingTime } from '../../lib/dateUtils'
import toast from 'react-hot-toast'

interface Props {
  slotTime: string        // UTC ISO
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

  const isMyBooking = currentBooking?.user_id === profile.id
  const isTaken = !!currentBooking && !isMyBooking
  const myWaitlistEntry = waitlistEntries.find(w => w.user_id === profile.id)
  const alreadyWaiting = !!myWaitlistEntry

  async function handleBook() {
    setLoading(true)
    const { error } = await supabase.rpc('book_slot', {
      p_start_time:  slotTime,
      p_booking_for: bookingFor,
      p_guest_name:  bookingFor === 'guest' ? guestName : null,
    })
    if (error) {
      // Supabase surfaces the exception message in error.message
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
              {currentBooking.booking_for === 'guest' && ' (para un invitado)'}
            </p>
            <div className="waitlist-info">
              <p className="waitlist-count">
                {waitlistEntries.length > 0
                  ? `${waitlistEntries.length} persona(s) en lista de espera`
                  : 'Sin lista de espera aún'}
              </p>
              <button
                className={alreadyWaiting ? 'btn-secondary' : 'btn-primary'}
                onClick={handleWaitlist}
                disabled={loading}
              >
                {alreadyWaiting ? 'Salir de la lista de espera' : 'Unirse a lista de espera'}
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            <div className="field">
              <label>Reservar para</label>
              <div className="radio-group">
                <label className={`radio-option ${bookingFor === 'self' ? 'selected' : ''}`}>
                  <input type="radio" value="self" checked={bookingFor === 'self'} onChange={() => setBookingFor('self')} />
                  Yo mismo
                </label>
                <label className={`radio-option ${bookingFor === 'guest' ? 'selected' : ''}`}>
                  <input type="radio" value="guest" checked={bookingFor === 'guest'} onChange={() => setBookingFor('guest')} />
                  Un invitado
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
                <small>Solo puedes reservar para invitados con hasta {rules.advance_days_guest} días de anticipación.</small>
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
