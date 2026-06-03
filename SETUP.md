# Tennis Court — Setup Guide

## Prerequisites
- Node ≥ 18
- A free [Supabase](https://supabase.com) project
- Vercel or Netlify account for frontend hosting

---

## 1. Supabase Project

### Database schema
In the Supabase dashboard → SQL Editor, run the full contents of:
```
supabase/migrations/001_initial_schema.sql
```

### Enable Realtime
Dashboard → Database → Replication → enable replication for:
- `bookings`
- `blocked_slots`
- `waitlist`

### Deploy the Edge Function
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy book-slot
```

### Make the first admin
After you register your own account via the app, run this in the SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'your@email.com';
```

---

## 2. Local development

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from
# Supabase dashboard → Project Settings → API
npm install
npm run dev
```

---

## 3. Deploy to Vercel

```bash
npm install -g vercel
vercel
# Set env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

Or connect the repo in the Vercel dashboard and set the env vars there.
Build command: `npm run build`  
Output directory: `dist`

---

## 4. Supabase Auth settings

Dashboard → Authentication → URL Configuration:
- Site URL: your Vercel/Netlify URL
- Redirect URLs: same URL + `/**`

---

## Key files

| File | Purpose |
|------|---------|
| `supabase/migrations/001_initial_schema.sql` | Full DB schema, RLS, and seed settings |
| `supabase/functions/book-slot/index.ts` | Edge Function — all fairness rule enforcement |
| `src/lib/constants.ts` | Court open/close hours |
| `src/lib/dateUtils.ts` | Panama timezone helpers (UTC-5, no DST) |
| `src/hooks/useCalendar.ts` | Realtime subscriptions |
| `src/components/admin/SettingsEditor.tsx` | Live rule editing without redeploy |

---

## Fairness rules (editable by admins at runtime)

| Key | Default | Meaning |
|-----|---------|---------|
| `advance_days_self` | 7 | Days ahead a member can book for themselves |
| `advance_days_guest` | 2 | Days ahead a member can book for a guest |
| `max_active_bookings` | 2 | Max concurrent future bookings per member |
| `max_per_day` | 1 | Max bookings per member per calendar day |
| `prime_start_hour` | 17 | Prime time start (24h, Panama local) |
| `prime_end_hour` | 20 | Prime time end (exclusive) |
| `prime_max_per_week` | 2 | Max prime slots per member per Mon–Sun week |
| `prime_weekdays_only` | true | Prime time applies only Mon–Fri |

---

## Phase 2 checklist (not yet built)
- [ ] Email confirmations via Supabase + Resend/SendGrid
- [ ] Automatic waitlist promotion on cancellation (DB trigger or Edge Function)
- [ ] WhatsApp notifications
