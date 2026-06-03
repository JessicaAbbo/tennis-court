import { useState } from 'react'
import type { Profile } from '../types'
import { useCalendar } from '../hooks/useCalendar'
import { useSettings } from '../hooks/useSettings'
import { CalendarGrid } from '../components/calendar/CalendarGrid'
import { getWeekStart, localToday } from '../lib/dateUtils'
import { BookingHistory } from '../components/admin/BookingHistory'

interface Props { profile: Profile }

export function CalendarPage({ profile }: Props) {
  const { rules } = useSettings()
  const today = localToday()

  // Single source of truth for the displayed week — shared between
  // CalendarPage (for data fetching) and CalendarGrid (for rendering)
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))

  // Build the UTC ISO string that useCalendar uses as a query anchor.
  // Panama midnight = 05:00 UTC
  const weekStartISO = (() => {
    const d = new Date(weekStart)
    d.setHours(5, 0, 0, 0)
    return d.toISOString()
  })()

  const { bookings, blockedSlots, waitlist, loading, refetch } = useCalendar(weekStartISO)

  return (
    <main className="page-main">
      <div className="page-section">
        <h2 className="section-title">Calendario de la Cancha</h2>
        {loading ? (
          <div className="loading-spinner">Cargando...</div>
        ) : (
          <CalendarGrid
            bookings={bookings}
            blockedSlots={blockedSlots}
            waitlist={waitlist}
            profile={profile}
            rules={rules}
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            onRefresh={refetch}
          />
        )}
      </div>
      <div className="page-section">
        <h2 className="section-title">Mis reservas</h2>
        <BookingHistory userId={profile.id} />
      </div>
    </main>
  )
}
