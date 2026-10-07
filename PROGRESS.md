# Progress

Worked top to bottom. Each item is ticked with how it was verified. Short names for tests:

- **core:** `packages/core/test/<file>` (Jest) · **mobile:** `apps/mobile/src/**/__tests__` (Jest + React Native Testing Library)
- **db:** `supabase/tests/<file>` (pgTAP) · **fn:** `supabase/functions/<name>/handler_test.ts` (Deno)
- **e2e-m:** `e2e/mobile/<spec>` (Playwright on the app's web build, 360dp, light + dark) · **e2e-w:** `e2e/web/<spec>`
- **manual #n:** `MANUAL_TESTS.md` step n (needs a real phone or live account)

Last full run of all six checks: see the bottom of this file.

## 0. Foundations
- [x] 0.1 Background-location spike: geofence enter/exit and location-update tasks (`apps/mobile/src/lib/device/tasks.ts`) feeding the shared tracker. Logic verified by mobile `tracker.test.ts`; on-device behaviour → manual #7–#8, `.maestro/03_background_rule.yaml`.
- [x] 0.2 Monorepo (pnpm workspaces), TypeScript strict, ESLint, Prettier, Deno for functions. `pnpm typecheck` and `pnpm lint` exit 0.
- [x] 0.3 Design tokens in one file (`packages/core/src/tokens.ts`), light and dark. core `tokens.test.ts` checks WCAG AA for every text pair; mobile `components.test.tsx` checks the app theme.
- [x] 0.4 `.env.example` lists every key read by the code (checked by script: every `process.env.*` / `Deno.env.get` key is present). `MESSAGING_MODE=fake` default. fn `providers_test.ts` "test runner forces MESSAGING_MODE=fake".
- [x] 0.5 Database schema with RLS on every table. db `001_schema`, `002_rls`.
- [x] 0.6 MessageProvider with FakeProvider, Africa's Talking SMS, WhatsApp Cloud. fn `providers_test.ts`.
- [x] 0.7 Design system components (Button, Card, Chip, ListRow/SwitchRow, Sheet, Segmented, Map, SosShield, Skeleton, EmptyState, Toast) with 48dp targets. mobile `components.test.tsx`; e2e-m `a11y.spec.ts`.

## 1. Onboarding (spec §3)
- [x] 1.1 Splash 1–2 s, then Home if signed in, else Welcome. e2e-m `onboarding.spec.ts` "a returning user goes straight to Home after the code".
- [x] 1.2 Welcome, 3 slides, Skip / Next / Get started. e2e-m onboarding "new user signs up…".
- [x] 1.3 Phone number with fixed +233, Send code disabled until valid, Terms/Privacy links. e2e-m onboarding; core `phone.test.ts`.
- [x] 1.4 Verify code: 6 boxes, wrong code message, Resend after 60 s, Change number. e2e-m onboarding; Android auto-read → manual #1.
- [x] 1.5 OTP by SMS through the Send SMS auth hook. fn `send-sms` (signature, stale timestamps, Android hash).
- [x] 1.6 Your name (required, used in messages) with live message preview. e2e-m onboarding.
- [x] 1.7 First contact: Choose from contacts or Enter number; intro SMS on save; Skip → Home card. e2e-m onboarding (both paths); db `006_messages`; phone picker → manual #4.
- [x] 1.8 Location explainer, then "Allow all the time" step with Open settings; Not now → banner. e2e-m onboarding; system prompts → manual #5.
- [x] 1.9 Notifications explainer, Turn on / Not now. e2e-m onboarding.
- [x] 1.10 Keep Reached running (Android) with brand steps. core `phase23.test.ts` "battery guides by brand"; device → manual #5, #8.
- [x] 1.11 Where's home: current location, search, GhanaPost GPS, Skip; "Tell Mom when you get home?" toggle. e2e-m onboarding.
- [x] 1.12 No internet at first launch: "Connect to the internet to sign up" + Try again. Implemented in `onboarding/phone.tsx`; covered by e2e-m smoke render; real network loss → manual #1.

## 2. Home (spec §4)
- [x] 2.1 Map-first Home: greeting + avatar, bell, SOS shield, status card ("You're covered · N places · N contacts"). e2e-m `smoke.spec.ts`, `trip.spec.ts`.
- [x] 2.2 Warning banners (location off, notifications off, battery, offline) with Fix. `features/useWarnings.ts`; e2e-m onboarding "skipping optional steps…".
- [x] 2.3 Active trip card during a trip. e2e-m `trip.spec.ts`.
- [x] 2.4 Start a trip; Send "I've reached" now sheet with area name. e2e-m trip "Send I've reached now goes to default contacts with the area".
- [x] 2.5 Quick places chips + Add. e2e-m trip, overdue.
- [x] 2.6 Recent activity (last 3) + See all. e2e-m trip "a trip to Work…".
- [x] 2.7 Contact request card and heading-out card (Phase 2). e2e-m `activity.spec.ts` "a contact asking REACHED…"; mobile `smart.test.ts` heading-out.

## 3. Trips (spec §5)
- [x] 3.1 Start a trip: search, saved places, Pick on map, GhanaPost GPS, I'm not sure yet. e2e-m trip; core `phase23.test.ts` GhanaPost; fn `geocode`.
- [x] 3.2 Who to tell chips (defaults pre-selected), message preview and per-contact edit. e2e-m trip "a trip needs someone to tell".
- [x] 3.3 Tell them I'm leaving now (on the way SMS). e2e-m trip; db `003_trips`.
- [x] 3.4 Check on me if I'm late: expected time, grace 10/15/30/60; without destination 30 min · 1 hr · 2 hrs · Custom. db `003_trips`, `004_overdue`; core `logic.test.ts` overdue timing.
- [x] 3.5 Trip details (Phase 2): transport, plate photo, driver, ride link, screenshot reading. core `phase23.test.ts` ride-hailing; fn `partner-api`; OCR on a phone → manual #30.
- [x] 3.6 Active trip: map, status line, I've arrived, Running late (+15/+30/+1 hr/Custom, tell them), Share live, Edit, Cancel quietly / Cancel and tell. e2e-m trip (arrive, cancel and tell, running late).
- [x] 3.7 Arrival detection with minimum stop time and vehicle check. core `logic.test.ts` arrival detection; mobile `tracker.test.ts`; e2e-m trip "passing through the zone in traffic…".
- [x] 3.8 Already inside destination at start → "Send arrival now?". e2e-m trip "starting a trip while already at the destination…".
- [x] 3.9 Auto-send by default; Ask me first with Send / Not now and 5-minute auto-send. e2e-m `activity.spec.ts` "Ask me first…"; db `005_rules`, `011_cron`; push buttons → manual #13.
- [x] 3.10 Arrived screen: tick, "Mom has been told", Sending → Sent → Delivered, Done → Home. e2e-m trip; fn `sms-delivery`.
- [x] 3.11 Server owns trip state; check-ins every minute. db `003_trips`.
- [x] 3.12 Offline arrival: queued, sent when back; after 5 minutes the SMS app opens with the text ready. mobile `outbox.test.ts`; e2e-m trip "an arrival with no internet waits…"; SMS app → manual #21.

## 4. Places and rules (spec §6)
- [x] 4.1 Places list with icon, name, area, rules summary; Add place; empty state. e2e-m `places.spec.ts`, smoke.
- [x] 4.2 Add/edit place: quick names, icon, current/search/map/GhanaPost, zone slider 100–500 m (default 150). e2e-m places; core `logic.test.ts` zone clamp.
- [x] 4.3 Save → Place detail with "Add a rule for this place?". e2e-m places.
- [x] 4.4 Place detail: rules with on/off switches, Add rule, Edit, Delete (confirm with rule count). e2e-m places "deleting a place…".
- [x] 4.5 Rule screen: Arrive/Leave, contacts, days presets, time window, message preview/edit, Save, Delete. e2e-m places; core `logic.test.ts` rules (days, overnight windows).
- [x] 4.6 Place rules fire on arrival and departure; two rules → one message per contact; 1-hour duplicate window. core `logic.test.ts`; db `005_rules`; e2e-m places "…arriving there tells Mom".
- [x] 4.7 Cap at 15 places (plan limits lower). db `010_phase3` plan limits; core `phase23.test.ts` plan limits.
- [x] 4.8 Suggested places (Phase 2). core `phase23.test.ts` suggested places; e2e-m places "a spot I keep stopping at…".

## 5. Contacts (spec §7)
- [x] 5.1 List with relationship, channel icons, default star, Opted out / Message failed badges. e2e-m `contacts.spec.ts`.
- [x] 5.2 Add contact (from phone or manually), Ghana number validation, intro SMS. e2e-m contacts; core `phase23.test.ts` validates contacts.
- [x] 5.3 Contact detail: edit, reach by, language (Phase 2), default switch, can ask where I am, Send test message, rules with this contact, Remove (confirm, removed from rules). e2e-m contacts "send a test message…"; db `005_rules`.
- [x] 5.4 STOP opt-out: skip them, badge, tell user once; START undoes. e2e-m contacts "STOP…"; fn `sms-inbound`, `whatsapp-webhook`; db `006_messages`.
- [x] 5.5 Contact requests (Phase 2): REACHED reply, Accept/Decline, 15-minute "hasn't responded yet". fn `sms-inbound`; db `009_phase2`; e2e-m activity.

## 6. Messages (spec §11)
- [x] 6.1 Every template word for word (en dash sent as "-", see DECISIONS #14). core `messages.test.ts` "matches the spec exactly".
- [x] 6.2 Every SMS ≤160 GSM-7 characters with realistic and long names. core `messages.test.ts`; fn `dispatch` "every body fits one GSM-7 SMS".
- [x] 6.3 Dispatch: claims queued messages, renders, sends, marks status; retries; WhatsApp routing. fn `dispatch`.
- [x] 6.4 Delivery reports → Delivered / Failed with plain reasons; Retry. fn `sms-delivery`; e2e-m contacts "a failed text…".
- [x] 6.5 "Phone may be off" added to overdue alerts when check-ins stopped. core `logic.test.ts` "detects a phone that may be off"; db `004_overdue`.
- [x] 6.6 Local-language templates (Phase 2), drafts. core `messages.test.ts` per-language limits; native-speaker review → manual #32.

## 7. Emergency (spec §8)
- [x] 7.1 Overdue check on the server every minute: "Are you okay?" at expected + grace. db `004_overdue`, `011_cron`.
- [x] 7.2 I'm okay → Have you arrived? Yes / Still on the way; Need more time +15/+30/+1 hr; Get help. e2e-m `overdue.spec.ts`; db `004_overdue`.
- [x] 7.3 No answer in 5 minutes → alert emergency contacts with last location and link; countdown shown. e2e-m overdue "no answer in 5 minutes…"; db `004_overdue`.
- [x] 7.4 I'm safe now needs phone unlock → All clear. e2e-m overdue, sos; unlock prompt → manual #15.
- [x] 7.5 SOS: hold 3 s (short tap shows hint), 5-second countdown with Cancel, alert, who was alerted, emergency numbers, location every 30 s, I'm safe now. e2e-m `sos.spec.ts`; mobile `components.test.tsx` SosShield; db `007_sos`.
- [x] 7.6 Every alert includes name, number, time, live link, battery, trip details. db `007_sos`; e2e-w `live.spec.ts`.
- [x] 7.7 Hands-free SOS (Phase 2): settings and setup guides; device triggers → manual #29.
- [x] 7.8 Police (Phase 3): nearest stations, dashboard for approved officers, "Also alert the police" switch hidden until partnership. core `phase23.test.ts` nearest police; e2e-w `staff.spec.ts`; db `010_phase3`.

## 8. Activity (spec §9)
- [x] 8.1 Filter chips All / Arrivals / Alerts / Requests; grouped by day; delivery status; footer; empty state. e2e-m `activity.spec.ts`, smoke; core `phase23.test.ts` activity helpers.
- [x] 8.2 Event detail: map, time, exact message, per-contact status, Resend, This wasn't right. e2e-m activity, contacts.

## 9. Settings (spec §10)
- [x] 9.1 Profile: name, photo, email, change number with OTP. Demo backend + `settings/profile.tsx`; live OTP → manual #26.
- [x] 9.2 Arrivals: auto / ask first (+ timeout), default message with preview, grace period, auto-detect and heading-out (Phase 2). e2e-m activity "Ask me first…"; smoke renders settings.
- [x] 9.3 Safety: emergency contacts, SOS hold length and countdown, emergency numbers, hands-free, police. e2e-m smoke; core emergency numbers.
- [x] 9.4 Notifications settings (late check-ins always on). smoke render; `settings/notifications.tsx`.
- [x] 9.5 Permissions and battery with Fix rows and Run a test. e2e-m activity "Run a test…".
- [x] 9.6 Privacy and data: Privacy Policy, Terms, who can see my location, keep activity 7/30 days, delete activity, download my data, delete account (OTP). e2e-m settings, activity; db `008_privacy`; fn `delete-account`.
- [x] 9.7 App and support: language, appearance (Light / Dark / Match phone), Help and FAQ, WhatsApp support, Report a problem, Invite, Rate, About, Log out (confirm). e2e-m settings.
- [x] 9.8 Plans (Phase 3): Free / Premium / Family with MoMo, Telecel Cash, AT Money, card. e2e-m activity "upgrading to Premium…"; fn `payments`; db `010_phase3`.

## 10. Push notifications (spec §12)
- [x] 10.1 Every notification type queued by the server with its buttons (categories in `lib/device/notifications.ts`), routed on tap. db `003_trips`, `004_overdue`; fn `dispatch` push tests; real delivery → manual #11–#15.
- [x] 10.2 "Arrivals may not work" when a permission or battery setting regresses. `useDeviceStatus` in `lib/hooks/useRuntime.ts`; device → manual #8.

## 11. Edge cases (spec §13)
- [x] 11.1 Phone dies mid-trip → server overdue + "phone may be off". db `004_overdue`; manual #16.
- [x] 11.2 No data at arrival. Item 3.12.
- [x] 11.3 Traffic / waiting. Item 3.7.
- [x] 11.4 Already inside destination. Item 3.8.
- [x] 11.5 Bouncing at zone edge (1 hour). core `logic.test.ts` "suppresses duplicate triggers within one hour"; db `005_rules`.
- [x] 11.6 Two rules at once → one message. core `logic.test.ts`; db `005_rules`.
- [x] 11.7 STOP. Item 5.4.
- [x] 11.8 Message failed → Failed + Retry push. Item 6.4.
- [x] 11.9 SMS allowance used (Phase 3) → WhatsApp where possible; safety always sent. core `phase23.test.ts`; db `010_phase3`.
- [x] 11.10 App force-closed → server notices; battery Fix banner. db `004_overdue`; manual #7.
- [x] 11.11 No internet at first launch. Item 1.12.
- [x] 11.12 No contacts / no places → empty states. e2e-m onboarding (skip path), smoke.

## 12. Web (spec §10, §11)
- [x] 12.1 Privacy Policy with every required section, DPC number, last-updated date, minimum age. e2e-w `pages.spec.ts`.
- [x] 12.2 Terms of Use. e2e-w pages.
- [x] 12.3 Account deletion page (Google Play) with OTP. e2e-w `delete-account.spec.ts`.
- [x] 12.4 Help and FAQ ("Why didn't my arrival send?"). e2e-w pages.
- [x] 12.5 Live location page (Phase 2): refresh every 30 s, last updated, Call, details only in emergencies, expiry. e2e-w `live.spec.ts`; db `012_live_autodetect`.
- [x] 12.6 Police and admin dashboards (Phase 3). e2e-w `staff.spec.ts`.

## 13. Privacy and data jobs
- [x] 13.1 Location pings deleted after 30 days; activity retention 7/30 days; cron jobs scheduled. db `008_privacy`, `011_cron`.
- [x] 13.2 No precise locations or full phone numbers in logs. fn `shared_test.ts` "logs never contain full phone numbers or coordinates".

## 14. Release readiness
- [x] 14.1 EAS build profiles (`apps/mobile/eas.json`) and Maestro flows (`.maestro/`). Device runs → manual (build section).
- [ ] 14.2 Live credentials, store accounts and on-device checks → `MANUAL_TESTS.md` (cannot be done from here).

## Last full run (2026-10-06, commit after this file)

| Command | Exit | Result |
|---|---|---|
| pnpm typecheck | 0 | core, mobile, web tsc + deno check clean |
| pnpm lint | 0 | eslint (max warnings 0) + deno lint clean |
| pnpm test | 0 | core 241 passed; mobile 35 passed |
| pnpm test:db | 0 | 12 files, 213 pgTAP assertions, PASS |
| pnpm test:functions | 0 | 74 passed, 0 failed |
| pnpm test:e2e | 0 | web 76 passed; mobile 54 passed (light + dark) |

No skipped tests. Full logs: `/mnt/project-files/reached-app/check-logs/`.
