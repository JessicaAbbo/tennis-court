import { useState, useMemo } from 'react'
// weekStart now comes from props — no local state needed for week navigation
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Booking, BlockedSlot, WaitlistEntry, Profile, BookingRules } from '../../types'
import {
  getWeekStart, getWeekDays, formatDayHeader, buildSlotUTC,
  formatHour, localToday,
} from '../../lib/dateUtils'
import { HOURS } from '../../lib/constants'
import { BookingModal } from './BookingModal'

interface Props {
  bookings: Booking[]
  blockedSlots: BlockedSlot[]
  waitlist: WaitlistEntry[]
  profile: Profile
  rules: BookingRules
  weekStart: Date
  onWeekChange: (d: Date) => void
  onRefresh: () => void
}

export function CalendarGrid({ bookings, blockedSlots, waitlist, profile, rules, weekStart, onWeekChange, onRefresh }: Props) {
  const today = localToday()
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const days = getWeekDays(weekStart)

  // Index bookings and blocked slots for O(1) lookup
  const bookingMap = useMemo(() => {
    const m = new Map<string, Booking>()
    // Normalize to .toISOString() so it matches the keys from buildSlotUTC
    bookings.forEach(b => m.set(new Date(b.start_time).toISOString(), b))
    return m
  }, [bookings])

  const blockedSet = useMemo(() => {
    const s = new Set<string>()
    blockedSlots.forEach(bl => {
      const start = new Date(bl.start_time).getTime()
      const end   = new Date(bl.end_time).getTime()
      days.forEach(day => {
        HOURS.forEach(h => {
          const slotMs = new Date(buildSlotUTC(day, h)).getTime()
          if (slotMs >= start && slotMs < end) s.add(buildSlotUTC(day, h))
        })
      })
    })
    return s
  }, [blockedSlots, days])

  const waitlistMap = useMemo(() => {
    const m = new Map<string, WaitlistEntry[]>()
    waitlist.forEach(w => {
      const arr = m.get(w.slot_time) ?? []
      arr.push(w)
      m.set(w.slot_time, arr)
    })
    return m
  }, [waitlist])

  const PRIME_START = rules.prime_start_hour
  const PRIME_END   = rules.prime_end_hour

  function isPrimeHour(hour: number, day: Date): boolean {
    if (rules.prime_weekdays_only) {
      const dow = day.getDay()
      if (dow === 0 || dow === 6) return false
    }
    return hour >= PRIME_START && hour < PRIME_END
  }

  function prevWeek() { const n = new Date(weekStart); n.setDate(n.getDate() - 7); onWeekChange(n) }
  function nextWeek() { const n = new Date(weekStart); n.setDate(n.getDate() + 7); onWeekChange(n) }

  const selectedBooking = selectedSlot ? bookingMap.get(selectedSlot) ?? null : null
  const selectedWaitlist = selectedSlot ? waitlistMap.get(selectedSlot) ?? [] : []

  // Max advance date for display
  const maxDate = new Date(today.getTime() + rules.advance_days_self * 24 * 60 * 60 * 1000)

  return (
    <div className="calendar-wrapper">
      <div className="calendar-nav">
        <button className="icon-btn" onClick={prevWeek}><ChevronLeft size={20} /></button>
        <span className="week-label">
          {formatDayHeader(days[0])} – {formatDayHeader(days[6])}
        </span>
        <button className="icon-btn" onClick={nextWeek}><ChevronRight size={20} /></button>
        <button className="btn-today" onClick={() => onWeekChange(getWeekStart(today))}>Hoy</button>
      </div>

      <div className="calendar-scroll">
        <table className="calendar-table">
          <thead>
            <tr>
              <th className="hour-col" />
              {days.map((day, i) => {
                const isToday = day.toDateString() === today.toDateString()
                return (
                  <th key={i} className={`day-col ${isToday ? 'today' : ''}`}>
                    {formatDayHeader(day)}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <td className="hour-label">{formatHour(hour)}</td>
                {days.map((day, di) => {
                  const slotUTC = buildSlotUTC(day, hour)
                  const slotMs  = new Date(slotUTC).getTime()
                  const nowMs   = Date.now()
                  const isPast  = slotMs <= nowMs
                  const isFar   = slotMs > maxDate.getTime()
                  const isBlocked = blockedSet.has(slotUTC)
                  const booking = bookingMap.get(slotUTC)
                  const isPrime = isPrimeHour(hour, day)
                  const isMySlot = booking?.user_id === profile.id
                  const waitCount = waitlistMap.get(slotUTC)?.length ?? 0

                  let cellClass = 'slot'
                  if (isPast)     cellClass += ' slot-past'
                  else if (isBlocked) cellClass += ' slot-blocked'
                  else if (booking)   cellClass += isMySlot ? ' slot-mine' : ' slot-taken'
                  else if (isFar)     cellClass += ' slot-far'
                  else                cellClass += ' slot-open'
                  if (isPrime && !isPast) cellClass += ' slot-prime'

                  const clickable = !isPast && !isBlocked && !isFar

                  return (
                    <td
                      key={di}
                      className={cellClass}
                      onClick={clickable ? () => setSelectedSlot(slotUTC) : undefined}
                      title={
                        isBlocked ? 'Bloqueado' :
                        booking ? `Reservado por ${booking.profile?.name ?? '...'}` :
                        isPast ? 'Pasado' :
                        isFar ? 'Fuera del rango de reservas' :
                        isPrime ? '⭐ Horario prime' : ''
                      }
                    >
                      {isBlocked && <span className="slot-label">🔒</span>}
                      {booking && (
                        <span className="slot-label">
                          {isMySlot ? '✓ Yo' : booking.profile?.name?.split(' ')[0]}
                          {booking.booking_for === 'guest' && ' 👤'}
                          {waitCount > 0 && <span className="wait-badge">{waitCount}</span>}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span className="legend-item slot-open">Libre</span>
        <span className="legend-item slot-mine">Mío</span>
        <span className="legend-item slot-taken">Reservado</span>
        <span className="legend-item slot-prime-legend">⭐ Prime</span>
        <span className="legend-item slot-blocked">🔒 Bloqueado</span>
      </div>

      {selectedSlot && (
        <BookingModal
          slotTime={selectedSlot}
          currentBooking={selectedBooking}
          waitlistEntries={selectedWaitlist}
          profile={profile}
          rules={rules}
          onClose={() => setSelectedSlot(null)}
          onBooked={onRefresh}
        />
      )}
    </div>
  )
}
