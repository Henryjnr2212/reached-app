#!/usr/bin/env bash
# pnpm test:functions — Deno tests for the Supabase Edge Functions.
# Always runs with MESSAGING_MODE=fake: no real SMS or WhatsApp is ever sent.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DENO="${DENO:-$ROOT/node_modules/.bin/deno}"
command -v "$DENO" >/dev/null 2>&1 || DENO=deno
cd "$ROOT/supabase/functions"
export MESSAGING_MODE=fake
"$DENO" test --allow-env --allow-read --no-prompt "$@"
