/**
 * Date utilities — fully browser-timezone-independent.
 *
 * Convention: "Panama Date objects" store the Panama calendar date in their
 * UTC fields (getUTCFullYear / getUTCMonth / getUTCDate / getUTCDay).
 * This means a Panama Date object whose UTC date is "June 3" represents
 * June 3 in Panama local time, regardless of the browser's timezone.
 *
 * Panama = UTC-5, no DST.
 */

import { DAY_NAMES_ES, MONTH_NAMES_ES } from './constants'

const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000  // 5 hours in ms

/** Today in Panama time, as a UTC-midnight Date object. */
export function localToday(): Date {
  const panamaMs = Date.now() - PANAMA_OFFSET_MS
  const p = new Date(panamaMs)
  return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()))
}

/** Monday of the week containing `date` (Panama Date object). */
export function getWeekStart(date: Date): Date {
  const dow = date.getUTCDay()          // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow // shift to Monday
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + diff
  ))
}

/** Seven Panama Date objects for the week starting at weekStart. */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + i
    ))
  )
}

/** "Lun 2 Jun" from a Panama Date object. */
export function formatDayHeader(date: Date): string {
  return `${DAY_NAMES_ES[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH_NAMES_ES[date.getUTCMonth()]}`
}

/**
 * UTC ISO string for a given Panama Date object + local hour.
 * Panama = UTC-5  →  UTC = local + 5 h
 */
export function buildSlotUTC(localDate: Date, hour: number): string {
  return new Date(Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
    hour + 5   // Panama offset
  )).toISOString()
}

/** "6:00 AM" / "5:00 PM" */
export function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}:00 ${hour < 12 ? 'AM' : 'PM'}`
}

/** "Lun 2 Jun, 6:00 PM" from a UTC ISO booking timestamp. */
export function formatBookingTime(utcIso: string): string {
  const panamaMs = new Date(utcIso).getTime() - PANAMA_OFFSET_MS
  const d = new Date(panamaMs)
  return `${DAY_NAMES_ES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES_ES[d.getUTCMonth()]}, ${formatHour(d.getUTCHours())}`
}

/** UTC ISO for Panama midnight of the given Panama Date object (= UTC 05:00 that day). */
export function panamaMidnightUTC(panamaDate: Date): string {
  return new Date(Date.UTC(
    panamaDate.getUTCFullYear(),
    panamaDate.getUTCMonth(),
    panamaDate.getUTCDate(),
    5   // midnight Panama = 05:00 UTC
  )).toISOString()
}
