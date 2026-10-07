#!/usr/bin/env bash
# pnpm test:db — pgTAP tests for schema, RLS policies and cron logic.
#
# Uses `supabase test db` when the Supabase CLI and a running local stack are
# available. Otherwise it starts a throwaway Postgres 16 cluster with pgTAP and
# pg_cron, applies scripts/db/supabase_shim.sql plus every migration, and runs
# the same test files with pg_prove.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v supabase >/dev/null 2>&1 && supabase status >/dev/null 2>&1; then
  exec supabase test db
fi

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [ -z "$PG_BIN" ] || [ ! -x "$PG_BIN/initdb" ]; then
  echo "Postgres server binaries not found. Install postgresql-16, postgresql-16-pgtap, postgresql-16-cron and pg_prove (see README)." >&2
  exit 1
fi
command -v pg_prove >/dev/null || { echo "pg_prove not found (apt install libtap-parser-sourcehandler-pgtap-perl)" >&2; exit 1; }

PORT="${TEST_DB_PORT:-54329}"
WORK="$(mktemp -d /tmp/reached-testdb.XXXXXX)"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$WORK"
  RUN_AS=(runuser -u postgres --)
fi
DATA="$WORK/data"

cleanup() {
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 >/dev/null
cat >> "$DATA/postgresql.conf" <<CONF
port = $PORT
listen_addresses = '127.0.0.1'
unix_socket_directories = '$WORK'
shared_preload_libraries = 'pg_cron'
cron.database_name = 'reached_test'
timezone = 'UTC'
fsync = off
CONF
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -l "$WORK/pg.log" -w start >/dev/null

export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres
psql -qX -v ON_ERROR_STOP=1 -d postgres -c "create database reached_test" >/dev/null
export PGDATABASE=reached_test

psql -qX -v ON_ERROR_STOP=1 >/dev/null <<SQL
create schema extensions;
create extension pgtap with schema extensions;
create extension pg_cron;
alter database reached_test set search_path = "\$user", public, extensions;
SQL
psql -qX -v ON_ERROR_STOP=1 -f scripts/db/supabase_shim.sql >/dev/null
psql -qX -v ON_ERROR_STOP=1 -c "grant temporary on database reached_test to anon, authenticated, service_role; grant execute on all functions in schema extensions to anon, authenticated, service_role;" >/dev/null
for f in supabase/migrations/*.sql; do
  psql -qX -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2> >(grep -v -E 'NOTICE|^$' >&2) || { echo "migration failed: $f" >&2; exit 1; }
done
psql -qX -v ON_ERROR_STOP=1 -f supabase/seed.sql >/dev/null

psql -qX -v ON_ERROR_STOP=1 -f scripts/db/test_helpers.sql >/dev/null

pg_prove --ext .sql -r supabase/tests
