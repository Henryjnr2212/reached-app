# Reached: build plan

Reached tells a user's chosen contacts by SMS (later WhatsApp) when the user arrives safely, and alerts emergency contacts when the user is overdue or holds the SOS shield. Contacts never need the app. Source of truth: `docs/SPEC.md`. Judgment calls: `DECISIONS.md`. Status: `PROGRESS.md` and `REQUIREMENTS_MAP.md`.

All three phases from the spec are built. Device-only and live-account checks are in `MANUAL_TESTS.md`.

## Architecture

```
            ┌──────────────── apps/mobile (Expo SDK 57, Expo Router) ────────────────┐
            │ screens ─ TanStack Query ─ Backend interface ─┬─ SupabaseBackend (prod)  │
            │ Zustand (device state)                       └─ DemoBackend (web/e2e)   │
            │ tracker.ts / smart.ts / outbox.ts  ← expo-location geofences + updates   │
            └───────────────────────────────┬─────────────────────────────────────────┘
                                            │ RPC (start_trip, arrive_trip, report_place_event, …)
┌──────────── supabase ─────────────────────▼─────────────────────────────────────────┐
│ Postgres: tables + RLS on every table; trip state machine and rules in SQL functions │
│ pg_cron (every minute): overdue checks, ask-first timeouts, request expiry, dispatch │
│ pg_cron (daily): 30-day location ping deletion, activity retention, subscriptions    │
│ Edge Functions (Deno): dispatch → MessageProvider (Fake | Africa's Talking | WhatsApp)│
│   send-sms (auth OTP hook), sms-inbound (STOP/START/REACHED), sms-delivery (reports), │
│   whatsapp-webhook, delete-account, geocode (GhanaPost), payments, partner-api       │
└──────────────────────────────────────────────────────────────────────────────────────┘
apps/web (Next.js on Vercel): privacy, terms, account deletion, help, live location page
/l/[token], police and admin dashboards (Phase 3).
packages/core: pure TypeScript shared by app, web and tests (rules, arrival detection,
overdue timing, SMS templates + GSM-7 fitting, phone validation, plans, design tokens).
```

Key rules from CLAUDE.md, and where they're enforced:

- **Server owns trip state.** `public.start_trip / arrive_trip / extend_trip / cancel_trip / respond_overdue` and `check_overdue_trips()` (cron). The phone only reports arrivals and check-ins.
- **Messaging never sends for real unless `MESSAGING_MODE=live`.** `supabase/functions/_shared/providers.ts` picks FakeProvider (writes `public.fake_messages`) by default; every test uses it.
- **E.164 +233 phones.** `packages/core/src/phone.ts` and `private.is_ghana_e164()` check constraints.
- **160 GSM-7 characters.** `packages/core/src/messages.ts` renders and shortens; `packages/core/test/messages.test.ts` checks every template with long realistic names.
- **Privacy.** Location pings deleted after 30 days (`cleanup_data()`), activity kept 7 or 30 days, no precise locations or full phone numbers in logs (`_shared/log.ts` drops lat/lng fields and masks phones).

## Folder structure

```
apps/
  mobile/                Expo app
    src/app/             Expo Router screens (onboarding/, (tabs)/, trip/, place/, rule/, contact/, event/, settings/, overdue, sos)
    src/features/        screen building blocks (ActiveTripCard, LocationPicker, ContactForm, MessageEditor, …)
    src/ui/              design system: Button, Card, Chip, ListRow/SwitchRow, Sheet, Map, SosShield, Text, theme
    src/lib/backend/     Backend interface + SupabaseBackend + DemoBackend
    src/lib/device/      location, notifications, background tasks, battery, local auth, OCR
    src/lib/             tracker, smart (auto-detect/heading-out), outbox (offline), store, hooks
  web/                   Next.js site and dashboards
packages/core/           shared logic + design tokens (+ Jest tests in test/)
supabase/
  migrations/            schema, RLS, functions, Phase 2 and 3, cron
  functions/             Edge Functions (Deno) with *_test.ts
  tests/                 pgTAP tests
e2e/web, e2e/mobile      Playwright end-to-end tests
.maestro/                device flows (Android emulator / phone)
scripts/                 test-db.sh, test-functions.sh, test-e2e.sh, deno.sh, serve-spa.mjs
```

## Data model

All tables in `public` have RLS: a user reads and writes only their own rows (`user_id = auth.uid()`); messages, events and trips are changed only through security-definer functions. Staff tables are readable only by approved police officers and admins.

| Table | Key columns | Notes |
|---|---|---|
| profiles | id (auth user), first_name, phone, photo_path, arrival_mode (auto/ask), ask_timeout_min, default_message, grace_min, sos_hold_s, sos_countdown_s, activity_retention_days, appearance, language, auto_detect, heading_out_prompts, plan, onboarded_at | one per user; protected columns (plan, phone) can't be self-edited |
| contacts | user_id, name, phone (E.164), relationship, channel (sms/whatsapp/both), language, is_default, is_emergency, can_request_location, opted_out, last_failed_at | intro SMS on insert; plan limit trigger |
| places | user_id, name, icon, lat, lng, radius (100–500), address, ghanapost_gps | max 15 (plan limits lower) |
| rules / rule_contacts | place_id, event (arrive/leave), days[], window_start/end, message, enabled | ownership checks on contacts and places |
| trips / trip_contacts | dest, radius, status (active/overdue/alerted/arrived/cancelled), expected_at, grace_min, check_on_me, overdue_prompted_at, last_checkin_at, live_token, transport, plate, driver, ride link | state changed only by functions |
| location_pings | trip_id, lat, lng, accuracy, battery, created_at | deleted after 30 days |
| events | kind (arrival, departure, on_the_way, running_late, plans_changed, overdue_alert, sos, all_clear, test, intro, contact_request), status, place_name, point, feedback | the Activity tab |
| messages | event_id, contact_id, channel, template, params, body, status (pending→sending→sent→delivered / failed / opted_out / held / cancelled), failure_reason, provider_id | one combined message per contact per event; 1-hour duplicate window |
| fake_messages | to, body, channel | FakeProvider output |
| notifications / push_tokens | kind, title, body, data, read_at | in-app inbox + Expo push |
| sos_alerts | status, started_at, ended_at, last point, battery | pings every 30 s |
| contact_requests | contact_id, status, expires_at | Phase 2 REACHED replies |
| subscriptions, family_members | plan, provider_ref, status, period | Phase 3 |
| police_stations, police_officers, partners, partner_links, admins, problem_reports | | Phase 3 |
| private.settings | key, value | functions URL, dispatch secret |

## Screens → spec sections

| Screen (file under apps/mobile/src/app) | Spec |
|---|---|
| onboarding/welcome, phone, verify, name, contact, location, notifications, battery, home | §3 |
| (tabs)/index (Home) | §4 |
| trip/start, trip/active, trip/arrived | §5 |
| (tabs)/places, place/new, place/[id], place/edit/[id], rule/[id] | §6 |
| (tabs)/contacts, contact/new, contact/[id] | §7 |
| overdue, sos, settings/hands-free, settings/police | §8 |
| (tabs)/activity, event/[id] | §9 |
| (tabs)/settings, settings/profile, plan, arrivals, safety, notifications, permissions, privacy, who-sees, delete-account, language, report, about | §10 |
| notifications (inbox) and push routing in lib/hooks/useRuntime.ts | §12 |
| apps/web: /privacy, /terms, /delete-account, /help, /l/[token], /police, /admin | §10, §11 live page, §8 police |

## Design

Built from the uploaded samples and `design-reference/`: a map-first Home with floating round controls, a big red SOS shield, soft white cards, pill chips, a dark pill primary button, bottom sheets, and a floating dark tab bar. Styling uses React Native StyleSheet with one token file (`packages/core/src/tokens.ts`), shared with the web.

| Token | Light | Dark |
|---|---|---|
| background | #F6F8F7 | #0B100E |
| surface | #FFFFFF | #141B18 |
| text | #111814 | #F1F5F3 |
| primary (calm green) | #0A7550 | #3DDC97 |
| accent (dark neutral) | #111814 | #F1F5F3 |
| danger (SOS) | #D92D20 | #F25A50 |

Spacing 2/4/8/12/16/20/24/32/48; radius 10/16/24/32/pill; type scale display 30, title 22, headline 17, body 15, label 14, caption 13 (Plus Jakarta Sans). Touch targets 48dp minimum, contrast WCAG AA (checked by `apps/mobile/src/ui/__tests__/components.test.tsx` and `e2e/mobile/a11y.spec.ts`).

## Testing

| Command | What runs |
|---|---|
| `pnpm typecheck` | tsc for core, mobile, web; `deno check` for functions |
| `pnpm lint` | ESLint (+ react-hooks) and `deno lint` |
| `pnpm test` | Jest: packages/core (logic, templates, phone, tokens) and apps/mobile (tracker, smart, outbox, demo backend, UI components) |
| `pnpm test:db` | pgTAP: schema, RLS, trips, overdue, rules, messages, SOS, privacy, Phase 2/3, cron |
| `pnpm test:functions` | Deno tests for every Edge Function with FakeProvider |
| `pnpm test:e2e` | Playwright: web site, and the mobile app's web build at 360dp in light and dark with mocked GPS |
