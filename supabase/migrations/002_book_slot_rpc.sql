-- ============================================================
-- 002 book_slot — server-side booking with all fairness checks
-- Called via supabase.rpc('book_slot', { ... })
-- Returns: { booking_id uuid } on success, raises exception on failure
-- ============================================================

create or replace function public.book_slot(
  p_start_time  timestamptz,
  p_booking_for text,          -- 'self' | 'guest'
  p_guest_name  text default null
)
returns jsonb
language plpgsql
security definer          -- runs as DB owner, bypasses RLS for reads
set search_path = public
as $$
declare
  v_user_id         uuid := auth.uid();
  v_end_time        timestamptz := p_start_time + interval '1 hour';
  v_now             timestamptz := now();

  -- settings
  v_advance_days    int;
  v_max_active      int;
  v_max_per_day     int;
  v_prime_start     int;
  v_prime_end       int;
  v_prime_max       int;
  v_prime_wd_only   boolean;

  -- counts
  v_active_count    int;
  v_day_count       int;
  v_prime_count     int;
  v_slot_hour       int;
  v_slot_dow        int;  -- 0=Sun … 6=Sat
  v_is_prime        boolean;

  -- day window (Panama UTC-5)
  v_day_start       timestamptz;
  v_day_end         timestamptz;
  -- week window
  v_week_start      timestamptz;
  v_week_end        timestamptz;
  v_days_to_mon     int;

  v_booking_id      uuid;
begin
  -- ── Caller must be authenticated ────────────────────────
  if v_user_id is null then
    raise exception 'No autorizado' using errcode = 'P0401';
  end if;

  -- ── Validate booking_for ─────────────────────────────────
  if p_booking_for not in ('self', 'guest') then
    raise exception 'Valor inválido para booking_for' using errcode = 'P0400';
  end if;
  if p_booking_for = 'guest' and (p_guest_name is null or trim(p_guest_name) = '') then
    raise exception 'El nombre del invitado es requerido' using errcode = 'P0400';
  end if;

  -- ── Load settings ─────────────────────────────────────────
  select
    (select value::int from settings where key = case when p_booking_for = 'guest'
                                                       then 'advance_days_guest'
                                                       else 'advance_days_self' end),
    (select value::int  from settings where key = 'max_active_bookings'),
    (select value::int  from settings where key = 'max_per_day'),
    (select value::int  from settings where key = 'prime_start_hour'),
    (select value::int  from settings where key = 'prime_end_hour'),
    (select value::int  from settings where key = 'prime_max_per_week'),
    (select value::boolean from settings where key = 'prime_weekdays_only')
  into v_advance_days, v_max_active, v_max_per_day,
       v_prime_start, v_prime_end, v_prime_max, v_prime_wd_only;

  -- ── Slot must be in the future ────────────────────────────
  if p_start_time <= v_now then
    raise exception 'No puedes reservar un turno en el pasado' using errcode = 'P0400';
  end if;

  -- ── Advance window ────────────────────────────────────────
  if p_start_time > v_now + (v_advance_days || ' days')::interval then
    raise exception 'Solo puedes reservar con hasta % día% de anticipación',
      v_advance_days, case when v_advance_days = 1 then '' else 's' end
      using errcode = 'P0400';
  end if;

  -- ── Slot blocked? ─────────────────────────────────────────
  if exists (
    select 1 from blocked_slots
    where start_time < v_end_time and end_time > p_start_time
  ) then
    raise exception 'Este turno está bloqueado por mantenimiento o evento'
      using errcode = 'P0400';
  end if;

  -- ── Slot already taken? (advisory — unique index is the real guard) ──
  if exists (
    select 1 from bookings
    where start_time = p_start_time and status = 'active'
  ) then
    raise exception 'Este turno ya está reservado' using errcode = 'P0409';
  end if;

  -- ── Max active future bookings ────────────────────────────
  select count(*) into v_active_count
  from bookings
  where user_id = v_user_id
    and status  = 'active'
    and start_time > v_now;

  if v_active_count >= v_max_active then
    raise exception 'Ya tienes % reservas activas. Cancela una para poder reservar.',
      v_max_active using errcode = 'P0400';
  end if;

  -- ── Max per day (Panama = UTC-5) ──────────────────────────
  -- Shift slot to local time to find midnight boundaries
  v_day_start := date_trunc('day', p_start_time at time zone 'America/Panama')
                   at time zone 'America/Panama';
  v_day_end   := v_day_start + interval '1 day';

  select count(*) into v_day_count
  from bookings
  where user_id   = v_user_id
    and status    = 'active'
    and start_time >= v_day_start
    and start_time <  v_day_end;

  if v_day_count >= v_max_per_day then
    raise exception 'Ya tienes % reserva% ese día.',
      v_max_per_day, case when v_max_per_day = 1 then '' else 's' end
      using errcode = 'P0400';
  end if;

  -- ── Prime-time cap ────────────────────────────────────────
  v_slot_hour := extract(hour from p_start_time at time zone 'America/Panama')::int;
  v_slot_dow  := extract(dow  from p_start_time at time zone 'America/Panama')::int;

  v_is_prime := v_slot_hour >= v_prime_start
            and v_slot_hour <  v_prime_end
            and (not v_prime_wd_only or (v_slot_dow between 1 and 5));

  if v_is_prime then
    -- Week = Mon 00:00 … Sun 23:59 Panama time
    v_days_to_mon := case v_slot_dow
                       when 0 then -6  -- Sunday → back 6 days
                       else 1 - v_slot_dow
                     end;
    v_week_start := date_trunc('day',
                      (p_start_time at time zone 'America/Panama')
                      + (v_days_to_mon || ' days')::interval)
                    at time zone 'America/Panama';
    v_week_end := v_week_start + interval '7 days';

    select count(*) into v_prime_count
    from bookings b
    where b.user_id    = v_user_id
      and b.status     = 'active'
      and b.start_time >= v_week_start
      and b.start_time <  v_week_end
      and extract(hour from b.start_time at time zone 'America/Panama') >= v_prime_start
      and extract(hour from b.start_time at time zone 'America/Panama') <  v_prime_end
      and (not v_prime_wd_only
           or extract(dow from b.start_time at time zone 'America/Panama') between 1 and 5);

    if v_prime_count >= v_prime_max then
      raise exception 'Ya tienes % reservas en horario prime esta semana (lun–vie %:00–%:00).',
        v_prime_max, v_prime_start, v_prime_end
        using errcode = 'P0400';
    end if;
  end if;

  -- ── All checks passed — insert ────────────────────────────
  insert into bookings (user_id, start_time, end_time, status, booking_for, guest_name)
  values (
    v_user_id,
    p_start_time,
    v_end_time,
    'active',
    p_booking_for,
    case when p_booking_for = 'guest' then trim(p_guest_name) else null end
  )
  returning id into v_booking_id;

  -- Remove caller from waitlist for this slot if present
  delete from waitlist
  where user_id   = v_user_id
    and slot_time = p_start_time;

  return jsonb_build_object('booking_id', v_booking_id);

exception
  when unique_violation then
    raise exception 'Este turno acaba de ser reservado por otra persona.'
      using errcode = 'P0409';
end;
$$;

-- Grant execute to authenticated users only
revoke all on function public.book_slot(timestamptz, text, text) from public;
grant execute on function public.book_slot(timestamptz, text, text) to authenticated;
