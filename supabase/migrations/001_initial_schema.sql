-- ============================================================
-- 001 Initial schema: profiles, bookings, blocked_slots,
--     waitlist, settings + RLS
-- ============================================================

-- ── Profiles ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null,
  unit        text not null,
  role        text not null default 'member' check (role in ('member','admin')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone logged in can read all profiles (needed to show "booked by X")
create policy "profiles: authenticated read"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Each user can insert and update their own profile
create policy "profiles: own insert"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can update any profile (role management)
create policy "profiles: admin update"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Bookings ──────────────────────────────────────────────────
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  status       text not null default 'active' check (status in ('active','cancelled')),
  booking_for  text not null default 'self' check (booking_for in ('self','guest')),
  guest_name   text,
  created_at   timestamptz not null default now(),
  -- One active booking per slot — prevents double-booking at DB level
  constraint bookings_unique_active_slot
    unique (start_time, status)
    deferrable initially deferred
);

-- Partial unique index: only one ACTIVE booking per start_time
create unique index if not exists bookings_start_time_active_uniq
  on public.bookings (start_time)
  where status = 'active';

alter table public.bookings enable row level security;

-- All authenticated users can read active bookings (to see the calendar)
create policy "bookings: authenticated read"
  on public.bookings for select
  using (auth.role() = 'authenticated');

-- Members can insert their own bookings (fairness logic enforced in Edge Function)
create policy "bookings: member insert"
  on public.bookings for insert
  with check (auth.uid() = user_id);

-- Members can cancel their own active bookings
create policy "bookings: member cancel"
  on public.bookings for update
  using (auth.uid() = user_id and status = 'active')
  with check (status = 'cancelled');

-- Admins can cancel anyone's booking
create policy "bookings: admin update"
  on public.bookings for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Blocked Slots ─────────────────────────────────────────────
create table if not exists public.blocked_slots (
  id          uuid primary key default gen_random_uuid(),
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  reason      text,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

alter table public.blocked_slots enable row level security;

create policy "blocked_slots: authenticated read"
  on public.blocked_slots for select
  using (auth.role() = 'authenticated');

create policy "blocked_slots: admin write"
  on public.blocked_slots for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Waitlist ──────────────────────────────────────────────────
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  slot_time   timestamptz not null,
  created_at  timestamptz not null default now(),
  unique (user_id, slot_time)
);

alter table public.waitlist enable row level security;

create policy "waitlist: authenticated read"
  on public.waitlist for select
  using (auth.role() = 'authenticated');

create policy "waitlist: member write"
  on public.waitlist for insert
  with check (auth.uid() = user_id);

create policy "waitlist: member delete own"
  on public.waitlist for delete
  using (auth.uid() = user_id);

create policy "waitlist: admin delete"
  on public.waitlist for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Settings ──────────────────────────────────────────────────
create table if not exists public.settings (
  key         text primary key,
  value       text not null,
  description text not null
);

alter table public.settings enable row level security;

create policy "settings: authenticated read"
  on public.settings for select
  using (auth.role() = 'authenticated');

create policy "settings: admin write"
  on public.settings for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Seed default settings
insert into public.settings (key, value, description) values
  ('advance_days_self',    '7',    'Días de anticipación para reservar (miembro)'),
  ('advance_days_guest',   '2',    'Días de anticipación para reservar (invitado)'),
  ('max_active_bookings',  '2',    'Máximo de reservas activas futuras por miembro'),
  ('max_per_day',          '1',    'Máximo de reservas por día por miembro'),
  ('prime_start_hour',     '17',   'Hora de inicio del horario prime (24h)'),
  ('prime_end_hour',       '20',   'Hora de fin del horario prime (24h)'),
  ('prime_max_per_week',   '2',    'Máximo de slots prime por miembro por semana'),
  ('prime_weekdays_only',  'true', 'El horario prime aplica solo en días de semana')
on conflict (key) do nothing;

-- ── Trigger: auto-create profile on sign-up ───────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name, unit, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'unit', ''),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
