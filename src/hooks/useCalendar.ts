import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Booking, BlockedSlot, WaitlistEntry } from '../types'

export function useCalendar(weekStartISO: string) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // weekStart and weekEnd as UTC ISO strings
  const weekStart = weekStartISO
  const weekEnd = new Date(new Date(weekStartISO).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  useEffect(() => {
    setLoading(true)
    fetchAll()

    // Realtime subscription on bookings table
    const channel = supabase
      .channel('calendar-' + weekStartISO)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => fetchBookings()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocked_slots' },
        () => fetchBlocked()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waitlist' },
        () => fetchWaitlist()
      )
      .subscribe()

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [weekStartISO])

  async function fetchAll() {
    await Promise.all([fetchBookings(), fetchBlocked(), fetchWaitlist()])
    setLoading(false)
  }

  async function fetchBookings() {
    const { data } = await supabase
      .from('bookings')
      .select('*, profile:profiles(id,name,unit,role)')
      .gte('start_time', weekStart)
      .lt('start_time', weekEnd)
      .eq('status', 'active')
    setBookings(data ?? [])
  }

  async function fetchBlocked() {
    const { data } = await supabase
      .from('blocked_slots')
      .select('*')
      .lt('start_time', weekEnd)
      .gt('end_time', weekStart)
    setBlockedSlots(data ?? [])
  }

  async function fetchWaitlist() {
    const { data } = await supabase
      .from('waitlist')
      .select('*, profile:profiles(id,name,unit)')
      .gte('slot_time', weekStart)
      .lt('slot_time', weekEnd)
    setWaitlist(data ?? [])
  }

  return { bookings, blockedSlots, waitlist, loading, refetch: fetchAll }
}
