#!/usr/bin/env bash
# Run deno check / deno lint over the Edge Functions with the repo-local Deno.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DENO="${DENO:-$ROOT/node_modules/.bin/deno}"
command -v "$DENO" >/dev/null 2>&1 || DENO=deno
cd "$ROOT/supabase/functions"
case "${1:-}" in
  check) "$DENO" check $(find . -name '*.ts' -not -path './node_modules/*') ;;
  lint) "$DENO" lint ;;
  *) echo "usage: deno.sh check|lint" >&2; exit 2 ;;
esac
