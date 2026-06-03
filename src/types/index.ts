export type Role = 'member' | 'admin'
export type BookingStatus = 'active' | 'cancelled'
export type BookingFor = 'self' | 'guest'

export interface Profile {
  id: string
  email: string
  name: string
  unit: string
  role: Role
  is_blocked: boolean
  created_at: string
}

export interface Booking {
  id: string
  user_id: string
  start_time: string // ISO UTC
  end_time: string   // ISO UTC
  status: BookingStatus
  booking_for: BookingFor
  guest_name: string | null
  created_at: string
  profile?: Profile
}

export interface BlockedSlot {
  id: string
  start_time: string
  end_time: string
  reason: string | null
  created_by: string
  created_at: string
}

export interface WaitlistEntry {
  id: string
  user_id: string
  slot_time: string
  created_at: string
  profile?: Profile
}

export interface Settings {
  key: string
  value: string
  description: string
}

export interface BookingRules {
  advance_days_self: number        // 7
  advance_days_guest: number       // 2
  max_active_bookings: number      // 2
  max_per_day: number              // 1
  prime_start_hour: number         // 17
  prime_end_hour: number           // 20
  prime_max_per_week: number       // 2
  prime_weekdays_only: boolean     // true
}
