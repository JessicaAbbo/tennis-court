import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Authenticate the calling user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return err('No autorizado', 401)

    const { data: { user }, error: authErr } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser()

    if (authErr || !user) return err('No autorizado', 401)

    const body = await req.json()
    const { start_time, booking_for, guest_name } = body as {
      start_time: string
      booking_for: 'self' | 'guest'
      guest_name?: string
    }

    if (!start_time || !booking_for) return err('Faltan campos requeridos', 400)
    if (booking_for === 'guest' && !guest_name?.trim())
      return err('El nombre del invitado es requerido', 400)

    // Load settings
    const { data: settingsRows } = await supabaseAdmin
      .from('settings')
      .select('key, value')
    const s = Object.fromEntries((settingsRows ?? []).map((r: any) => [r.key, r.value]))

    const advanceDays   = booking_for === 'guest' ? parseInt(s.advance_days_guest) : parseInt(s.advance_days_self)
    const maxActive     = parseInt(s.max_active_bookings)
    const maxPerDay     = parseInt(s.max_per_day)
    const primeStart    = parseInt(s.prime_start_hour)
    const primeEnd      = parseInt(s.prime_end_hour)
    const primeMax      = parseInt(s.prime_max_per_week)
    const primeWdOnly   = s.prime_weekdays_only === 'true'

    const slotStart = new Date(start_time)
    const slotEnd   = new Date(slotStart.getTime() + 60 * 60 * 1000)

    // ── Validate slot is in the future ────────────────────────
    const now = new Date()
    if (slotStart <= now) return err('No puedes reservar un turno en el pasado', 400)

    // ── Advance booking window ─────────────────────────────────
    const maxAdvanceMs = advanceDays * 24 * 60 * 60 * 1000
    if (slotStart.getTime() - now.getTime() > maxAdvanceMs)
      return err(
        `Solo puedes reservar con hasta ${advanceDays} día${advanceDays !== 1 ? 's' : ''} de anticipación`,
        400
      )

    // ── Slot is blocked? ───────────────────────────────────────
    const { data: blocked } = await supabaseAdmin
      .from('blocked_slots')
      .select('id')
      .lt('start_time', slotEnd.toISOString())
      .gt('end_time', slotStart.toISOString())
      .limit(1)
    if (blocked && blocked.length > 0)
      return err('Este turno está bloqueado por mantenimiento o evento', 400)

    // ── Slot already taken? ────────────────────────────────────
    const { data: taken } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('start_time', slotStart.toISOString())
      .eq('status', 'active')
      .limit(1)
    if (taken && taken.length > 0)
      return err('Este turno ya está reservado', 400)

    // ── Member's own active bookings count ────────────────────
    const { count: activeCount } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('start_time', now.toISOString())
    if ((activeCount ?? 0) >= maxActive)
      return err(
        `Ya tienes ${maxActive} reservas activas. Cancela una para poder reservar.`,
        400
      )

    // ── Max per day ────────────────────────────────────────────
    // Day boundaries in Panama (UTC-5)
    const localOffset = -5 * 60 * 60 * 1000
    const slotLocalMs = slotStart.getTime() + localOffset
    const slotLocalDate = new Date(slotLocalMs)
    slotLocalDate.setHours(0, 0, 0, 0)
    const dayStartUTC = new Date(slotLocalDate.getTime() - localOffset)
    const dayEndUTC   = new Date(dayStartUTC.getTime() + 24 * 60 * 60 * 1000)

    const { count: dayCount } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('start_time', dayStartUTC.toISOString())
      .lt('start_time', dayEndUTC.toISOString())
    if ((dayCount ?? 0) >= maxPerDay)
      return err(
        `Ya tienes ${maxPerDay} reserva${maxPerDay !== 1 ? 's' : ''} ese día.`,
        400
      )

    // ── Prime-time cap ─────────────────────────────────────────
    const slotLocalHour = slotLocalDate.getHours() // actually need the slot's local hour
    // Re-derive slot hour in local time
    const slotHourLocal = new Date(slotStart.getTime() + localOffset).getHours()
    const slotDayOfWeek = new Date(slotStart.getTime() + localOffset).getDay() // 0=Sun

    const isPrime =
      slotHourLocal >= primeStart &&
      slotHourLocal < primeEnd &&
      (!primeWdOnly || (slotDayOfWeek >= 1 && slotDayOfWeek <= 5))

    if (isPrime) {
      // Week boundaries (Monday–Sunday) in Panama time
      const slotLocalFull = new Date(slotStart.getTime() + localOffset)
      const dow = slotLocalFull.getDay()
      const diffToMon = dow === 0 ? -6 : 1 - dow
      const monLocal = new Date(slotLocalFull)
      monLocal.setDate(monLocal.getDate() + diffToMon)
      monLocal.setHours(0, 0, 0, 0)
      const weekStartUTC = new Date(monLocal.getTime() - localOffset)
      const weekEndUTC   = new Date(weekStartUTC.getTime() + 7 * 24 * 60 * 60 * 1000)

      const { data: primeBookings } = await supabaseAdmin
        .from('bookings')
        .select('start_time')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('start_time', weekStartUTC.toISOString())
        .lt('start_time', weekEndUTC.toISOString())

      const primeCount = (primeBookings ?? []).filter((b: any) => {
        const h = new Date(new Date(b.start_time).getTime() + localOffset).getHours()
        const wd = new Date(new Date(b.start_time).getTime() + localOffset).getDay()
        return h >= primeStart && h < primeEnd && (!primeWdOnly || (wd >= 1 && wd <= 5))
      }).length

      if (primeCount >= primeMax)
        return err(
          `Ya tienes ${primeMax} reservas en horario prime esta semana (lunes–viernes ${primeStart}:00–${primeEnd}:00).`,
          400
        )
    }

    // ── All checks passed — insert booking ────────────────────
    const { data: booking, error: insertErr } = await supabaseAdmin
      .from('bookings')
      .insert({
        user_id:     user.id,
        start_time:  slotStart.toISOString(),
        end_time:    slotEnd.toISOString(),
        status:      'active',
        booking_for,
        guest_name:  booking_for === 'guest' ? guest_name!.trim() : null,
      })
      .select()
      .single()

    if (insertErr) {
      // Unique constraint violation = race condition, slot just got taken
      if (insertErr.code === '23505')
        return err('Este turno acaba de ser reservado por otra persona.', 409)
      throw insertErr
    }

    // ── Remove from waitlist if member was waiting ─────────────
    await supabaseAdmin
      .from('waitlist')
      .delete()
      .eq('user_id', user.id)
      .eq('slot_time', slotStart.toISOString())

    return new Response(JSON.stringify({ booking }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })
  } catch (e: any) {
    console.error(e)
    return err('Error interno del servidor', 500)
  }
})

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}
