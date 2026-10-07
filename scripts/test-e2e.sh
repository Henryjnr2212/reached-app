#!/usr/bin/env bash
# pnpm test:e2e — end-to-end flows in a browser, using the demo backend and
# FakeProvider-style simulated messages (no network, no real SMS).
#
#  1. Builds apps/web in demo mode and runs e2e/web (Next.js pages).
#  2. Exports apps/mobile for the web with EXPO_PUBLIC_BACKEND=demo and runs
#     e2e/mobile against it at 360dp, in light and dark mode, with mocked GPS.
#
# The Maestro flows in .maestro/ cover the same journeys on an Android
# emulator or phone (background location, notifications); see MANUAL_TESTS.md.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export CI="${CI:-1}" NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1

echo "› Building the web pages (demo mode)"
NEXT_PUBLIC_DEMO=1 pnpm --filter @reached/web build >/dev/null

echo "› Exporting the mobile app for the web (demo backend)"
(cd apps/mobile && rm -rf dist && EXPO_OFFLINE=1 EXPO_PUBLIC_BACKEND=demo npx expo export --platform web --output-dir dist >/dev/null)

echo "› e2e/web"
pnpm exec playwright test -c e2e/web/playwright.config.ts
echo "› e2e/mobile"
pnpm exec playwright test -c e2e/mobile/playwright.config.ts
