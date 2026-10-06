# Reached — project guide for Claude

## What this is
Reached is a mobile app for Ghana that tells a user's chosen contacts (by SMS, later WhatsApp) when the user arrives somewhere safely, and alerts them if the user is overdue or triggers SOS. Contacts never need the app. Publisher: Osnw Tech Studio.

- Product spec (source of truth for every screen, button, setting, message and edge case): `docs/SPEC.md`
- UI templates to follow: `design-reference/`

## Current scope
All three phases from the spec are built (the owner asked for every phase). PROGRESS.md and REQUIREMENTS_MAP.md track status.

## Stack
- `apps/mobile`: Expo (latest stable SDK), TypeScript strict, Expo Router, expo-dev-client (a development build is required; Expo Go cannot run background location), expo-location + expo-task-manager (geofencing and background updates), expo-notifications, react-native-maps, TanStack Query, Zustand, react-hook-form + zod, Reanimated. Styling: React Native StyleSheet with the single token file `packages/core/src/tokens.ts` (NativeWind was replaced; see DECISIONS.md).
- `packages/core`: pure TypeScript business logic with no React Native imports (arrival rules, duplicate suppression, overdue timing, message rendering, phone number validation).
- `supabase/`: Postgres, Auth with phone OTP (SMS delivered through the Send SMS hook to Africa's Talking), Edge Functions (Deno), pg_cron for overdue checks and data cleanup, Row Level Security on every table.
- `apps/web`: Next.js for Vercel: Privacy Policy, Terms of Use, and the account deletion page required by Google Play.
- Messaging goes through one `MessageProvider` interface with three implementations: `AfricasTalkingSms`, `WhatsAppCloud` (stub in Phase 1), and `FakeProvider`, which writes messages to a table instead of sending. Tests and local development always use `FakeProvider`.

## Rules
- Never commit secrets. Use `.env` (gitignored) and keep `.env.example` listing every key.
- Never send a real SMS or WhatsApp message unless `MESSAGING_MODE=live`. The default is `fake`.
- The server is the source of truth for trip state. Overdue detection runs on the server (pg_cron), never only on the phone.
- Delete trip location pings after 30 days with a scheduled job. Do not log precise locations in production builds.
- Every SMS template must fit in 160 GSM-7 characters with realistic names and places filled in. Enforce this with a unit test.
- Store phone numbers in E.164 format (+233…) and validate Ghana numbers.
- If the spec is ambiguous, choose the most reasonable option, record it in `DECISIONS.md`, and continue. Only stop to ask when truly blocked (missing credentials, paid accounts, physical devices).

## UI/UX standards
- Follow the layout patterns, components, spacing and visual feel of `design-reference/`, adapted to Reached's screens. Do not copy the templates' logos, names or placeholder content.
- Modern, calm and trustworthy: a single design-token file (colours, spacing, radius, type scale); light and dark mode; touch targets of at least 48dp; WCAG AA contrast; one clear primary action per screen; bottom sheets for quick actions; skeleton loaders instead of spinners; haptic feedback on key actions; friendly empty states; plain-language error messages shown inline.
- Must feel fast on small, low-end Android phones (360dp wide, 2–3 GB RAM): virtualized lists, no heavy animation inside list items, fast cold start.
- Brand: the name is "Reached". Calm green primary colour with a dark neutral accent, defined as tokens so it is easy to change later.

## Commands (keep all of these working)
- `pnpm typecheck` — tsc --noEmit across all packages
- `pnpm lint`
- `pnpm test` — Jest for packages/core and apps/mobile (React Native Testing Library)
- `pnpm test:db` — `supabase test db` (pgTAP: schema, RLS policies, cron logic)
- `pnpm test:functions` — deno test for Edge Functions
- `pnpm test:e2e` — Playwright against the web site and the mobile app's web build (demo backend, mocked GPS); the Maestro flows in `.maestro/` run the device journeys on an emulator or phone (see DECISIONS.md and MANUAL_TESTS.md)

## Workflow
- Work through `PROGRESS.md` from top to bottom, one task at a time: implement → write or extend tests → run the relevant checks → tick the box with a one-line note on how it was verified → commit (`git commit -m "<area>: <what>"`).
- Never tick a box without a passing check or a written verification note.
- Anything that can only be verified on a real phone or with live credentials (real background location on Tecno/Infinix/Samsung, real SMS delivery) goes in `MANUAL_TESTS.md` as numbered steps for the human. Do not mark it done.
- Keep `REQUIREMENTS_MAP.md` updated as items are completed.
