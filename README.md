# Reached

Reached tells your people you arrived safely, without you having to remember. A safe-arrival app for Ghana by Osnw Tech Studio. Contacts get an SMS (later WhatsApp) and never need the app.

- Product spec: `docs/SPEC.md` · Plan and architecture: `PLAN.md` · Status: `PROGRESS.md`, `REQUIREMENTS_MAP.md`
- Judgment calls: `DECISIONS.md` · Real-phone and live-account checks: `MANUAL_TESTS.md`

## What's here

| Folder | What |
|---|---|
| `apps/mobile` | Expo (SDK 57) app with Expo Router: onboarding, Home, trips, places and rules, contacts, activity, overdue and SOS, settings |
| `apps/web` | Next.js site: Privacy Policy, Terms, account deletion, help, live location page, police and admin dashboards |
| `packages/core` | Shared TypeScript logic (rules, arrival detection, overdue timing, SMS templates, phone validation, plans) and design tokens |
| `supabase` | Postgres migrations with RLS, pg_cron jobs, Edge Functions (Deno), pgTAP tests |
| `e2e` | Playwright tests for the web site and the mobile app's web build |
| `.maestro` | Device flows for an Android emulator or phone |

## Requirements

Node 22+, pnpm 10, Deno 2 (installed as a dev dependency), and for the database tests either the Supabase CLI with Docker or local Postgres 16 with pgTAP, pg_cron and `pg_prove`. Phone builds need an Expo account and EAS (see `MANUAL_TESTS.md`).

## Getting started

```bash
pnpm install
cp .env.example .env            # MESSAGING_MODE stays "fake" for development

# Try the app in a browser with the in-memory demo backend (no accounts needed)
cd apps/mobile && EXPO_PUBLIC_BACKEND=demo npx expo start --web
# Sign in with any Ghana number, e.g. 024 123 4567, and code 123456.

# Or run against local Supabase
supabase start                   # prints the anon key for EXPO_PUBLIC_SUPABASE_ANON_KEY
supabase db reset                # applies migrations and seed.sql
supabase functions serve
cd apps/mobile && npx expo start --dev-client   # needs a development build (eas build --profile development)

# Web site
NEXT_PUBLIC_DEMO=1 pnpm --filter @reached/web dev
```

In fake mode every text goes to the `public.fake_messages` table instead of a phone. Real SMS is only sent when `MESSAGING_MODE=live` is set on the deployed functions.

## Checks

All six must exit 0 with no skipped tests. There is no hosted CI yet, so run them locally before merging (a GitHub Actions version is in git history: `git show 7cf8c2e:.github/workflows/checks.yml`):

```bash
pnpm typecheck        # tsc + deno check
pnpm lint             # eslint + deno lint
pnpm test             # Jest: packages/core and apps/mobile
pnpm test:db          # pgTAP (supabase test db, or a throwaway local Postgres)
pnpm test:functions   # Deno tests for Edge Functions with FakeProvider
pnpm test:e2e         # builds the web site and the app's web export, then Playwright
```

Device-only behaviour (background location on Tecno/Infinix/Samsung, real SMS delivery, push buttons) is covered by `MANUAL_TESTS.md` and `.maestro/`.

## Design

Map-first Home with floating round controls, a big red SOS shield, soft cards, pill chips and a floating tab bar, in light and dark. Tokens live in `packages/core/src/tokens.ts`; components in `apps/mobile/src/ui`. Every screen works at 360dp with 48dp touch targets and WCAG AA contrast.
