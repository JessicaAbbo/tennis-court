import { TIMEZONE, DAY_NAMES_ES, MONTH_NAMES_ES } from './constants'

/** Convert a UTC ISO string to a Date object for display in Panama time */
export function toLocalDate(utcIso: string): Date {
  return new Date(utcIso)
}

/** Format hour as "6:00 AM" style in Panama timezone */
export function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h}:00 ${ampm}`
}

/** Get the start of the current week (Monday) in Panama time as a Date */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday = start
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Return array of 7 Date objects for the week starting from weekStart */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** Format a date as "Lun 2 Jun" */
export function formatDayHeader(date: Date): string {
  const dayName = DAY_NAMES_ES[date.getDay()]
  const month = MONTH_NAMES_ES[date.getMonth()]
  return `${dayName} ${date.getDate()} ${month}`
}

/** Build a UTC ISO string for a given local date + hour (Panama = UTC-5) */
export function buildSlotUTC(localDate: Date, hour: number): string {
  const d = new Date(localDate)
  d.setHours(hour, 0, 0, 0)
  // Panama is UTC-5 (no DST)
  const utcMs = d.getTime() + 5 * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

/** Parse a UTC ISO string into local Panama hour (0-23) */
export function utcToLocalHour(utcIso: string): number {
  const utcMs = new Date(utcIso).getTime()
  const localMs = utcMs - 5 * 60 * 60 * 1000
  return new Date(localMs).getHours()
}

/** Get local Panama date from UTC ISO (date portion only) */
export function utcToLocalDateStr(utcIso: string): string {
  const utcMs = new Date(utcIso).getTime()
  const localMs = utcMs - 5 * 60 * 60 * 1000
  const d = new Date(localMs)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Today's date at midnight in local Panama time */
export function localToday(): Date {
  const nowUtc = Date.now()
  const localMs = nowUtc - 5 * 60 * 60 * 1000
  const d = new Date(localMs)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Format a full datetime for display: "Lun 2 Jun, 6:00 PM" */
export function formatBookingTime(utcIso: string): string {
  const utcMs = new Date(utcIso).getTime()
  const localMs = utcMs - 5 * 60 * 60 * 1000
  const d = new Date(localMs)
  const dayName = DAY_NAMES_ES[d.getDay()]
  const month = MONTH_NAMES_ES[d.getMonth()]
  const hour = formatHour(d.getHours())
  return `${dayName} ${d.getDate()} ${month}, ${hour}`
}

export { TIMEZONE }
