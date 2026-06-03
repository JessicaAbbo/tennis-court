import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Booking } from '../../types'
import { formatBookingTime } from '../../lib/dateUtils'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface Props { isAdmin?: boolean; userId?: string }

export function BookingHistory({ isAdmin, userId }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'cancelled'>('active')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchBookings() }, [filter, userId])

  async function fetchBookings() {
    setLoading(true)
    let q = supabase
      .from('bookings')
      .select('*, profile:profiles(id,name,unit)')
      .order('start_time', { ascending: false })
      .limit(200)

    if (filter !== 'all') q = q.eq('status', filter)
    if (userId) q = q.eq('user_id', userId)

    const { data } = await q
    setBookings(data ?? [])
    setLoading(false)
  }

  async function cancelBooking(id: string) {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    if (error) toast.error('Error al cancelar')
    else { toast.success('Reserva cancelada'); fetchBookings() }
  }

  return (
    <div className="booking-history">
      <div className="filter-bar">
        {(['active', 'all', 'cancelled'] as const).map(f => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'active' ? 'Activas' : f === 'cancelled' ? 'Canceladas' : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading-text">Cargando...</p>
      ) : bookings.length === 0 ? (
        <p className="empty-msg">Sin reservas en este filtro</p>
      ) : (
        <div className="bookings-table-wrap">
          <table className="bookings-table">
            <thead>
              <tr>
                {isAdmin && <th>Residente</th>}
                <th>Turno</th>
                <th>Para</th>
                <th>Estado</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className={b.status === 'cancelled' ? 'row-cancelled' : ''}>
                  {isAdmin && (
                    <td>
                      <span className="resident-name">{b.profile?.name}</span>
                      <span className="resident-unit">Apt. {b.profile?.unit}</span>
                    </td>
                  )}
                  <td>{formatBookingTime(b.start_time)}</td>
                  <td>
                    {b.booking_for === 'guest'
                      ? <span>Invitado: {b.guest_name}</span>
                      : <span>Yo</span>}
                  </td>
                  <td>
                    <span className={`status-badge ${b.status}`}>
                      {b.status === 'active' ? 'Activa' : 'Cancelada'}
                    </span>
                  </td>
                  {isAdmin && b.status === 'active' && (
                    <td>
                      <button className="icon-btn danger" onClick={() => cancelBooking(b.id)}>
                        <X size={16} />
                      </button>
                    </td>
                  )}
                  {isAdmin && b.status !== 'active' && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
