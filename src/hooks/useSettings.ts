import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BookingRules } from '../types'

const DEFAULTS: BookingRules = {
  advance_days_self:    7,
  advance_days_guest:   2,
  max_active_bookings:  2,
  max_per_day:          1,
  prime_start_hour:     17,
  prime_end_hour:       20,
  prime_max_per_week:   2,
  prime_weekdays_only:  true,
}

export function useSettings() {
  const [rules, setRules] = useState<BookingRules>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('settings').select('key, value').then(({ data }) => {
      if (data) {
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]))
        setRules({
          advance_days_self:   parseInt(map.advance_days_self   ?? '7'),
          advance_days_guest:  parseInt(map.advance_days_guest  ?? '2'),
          max_active_bookings: parseInt(map.max_active_bookings ?? '2'),
          max_per_day:         parseInt(map.max_per_day         ?? '1'),
          prime_start_hour:    parseInt(map.prime_start_hour    ?? '17'),
          prime_end_hour:      parseInt(map.prime_end_hour      ?? '20'),
          prime_max_per_week:  parseInt(map.prime_max_per_week  ?? '2'),
          prime_weekdays_only: (map.prime_weekdays_only ?? 'true') === 'true',
        })
      }
      setLoading(false)
    })
  }, [])

  return { rules, loading }
}
