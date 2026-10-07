/**
 * Test doubles: an in-memory stand-in for the supabase-js client (only the
 * surface the functions use) and a recording fetch. Never imported by
 * production code.
 */
import type { AuthApi, AuthUser, DbClient, DbError, DbQuery, DbResult, DbTable } from './db.ts';
import type { FetchFn } from './providers.ts';

export type Row = Record<string, unknown>;
type RpcHandler = (args: Record<string, unknown>) => unknown;

type Filter = (row: Row) => boolean;

class FakeQuery implements DbQuery {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private max: number | null = null;
  private returning = false;

  constructor(
    private db: FakeDb,
    private table: string,
    private op: 'select' | 'insert' | 'update' | 'delete',
    private payload?: Row | Row[],
  ) {}

  select(_columns?: string): DbQuery {
    if (this.op !== 'select') this.returning = true;
    return this;
  }
  eq(column: string, value: unknown): DbQuery {
    this.filters.push((r) => r[column] === value);
    return this;
  }
  is(column: string, value: null | boolean): DbQuery {
    this.filters.push((r) => (r[column] ?? null) === value);
    return this;
  }
  in(column: string, values: readonly unknown[]): DbQuery {
    this.filters.push((r) => values.includes(r[column]));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }): DbQuery {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }
  limit(count: number): DbQuery {
    this.max = count;
    return this;
  }
  maybeSingle(): PromiseLike<DbResult> {
    return this.run().then(({ data, error }) => {
      if (error) return { data: null, error };
      const rows = (data ?? []) as Row[];
      if (rows.length > 1) return { data: null, error: { message: 'multiple rows' } };
      return { data: rows[0] ?? null, error: null };
    });
  }
  then<A = DbResult, B = never>(
    onfulfilled?: ((value: DbResult) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }

  private run(): Promise<DbResult> {
    const { db, table } = this;
    db.queries.push({ table, op: this.op });
    const fail = db.failTables[table];
    if (fail) return Promise.resolve({ data: null, error: { message: fail } });
    const rows = db.table(table);
    const match = (r: Row) => this.filters.every((f) => f(r));
    let data: Row[] | null = null;
    switch (this.op) {
      case 'insert': {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
        const inserted = list.map((r) => ({ id: r.id ?? db.nextId++, ...r }));
        rows.push(...inserted);
        data = this.returning ? inserted.map((r) => ({ ...r })) : null;
        break;
      }
      case 'select': {
        let found = rows.filter(match);
        if (this.orderBy) {
          const { column, ascending } = this.orderBy;
          found = [...found].sort((a, b) => {
            const x = String(a[column] ?? ''), y = String(b[column] ?? '');
            return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
          });
        }
        if (this.max !== null) found = found.slice(0, this.max);
        data = found.map((r) => ({ ...r }));
        break;
      }
      case 'update': {
        const found = rows.filter(match);
        for (const r of found) Object.assign(r, this.payload);
        data = this.returning ? found.map((r) => ({ ...r })) : null;
        break;
      }
      case 'delete': {
        const removed = rows.filter(match);
        db.tables[table] = rows.filter((r) => !match(r));
        data = this.returning ? removed : null;
        break;
      }
    }
    return Promise.resolve({ data, error: null });
  }
}

export class FakeDb implements DbClient {
  tables: Record<string, Row[]> = {};
  rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  queries: { table: string; op: string }[] = [];
  failTables: Record<string, string> = {};
  nextId = 1;
  /** jwt → user, for auth.getUser */
  users: Record<string, AuthUser> = {};
  deletedUsers: string[] = [];

  constructor(private handlers: Record<string, RpcHandler> = {}) {}

  table(name: string): Row[] {
    return (this.tables[name] ??= []);
  }

  onRpc(fn: string, handler: RpcHandler): this {
    this.handlers[fn] = handler;
    return this;
  }

  callsTo(fn: string): Record<string, unknown>[] {
    return this.rpcCalls.filter((c) => c.fn === fn).map((c) => c.args);
  }

  rpc(fn: string, args: Record<string, unknown> = {}): PromiseLike<DbResult> {
    this.rpcCalls.push({ fn, args });
    const h = this.handlers[fn];
    if (!h) return Promise.resolve({ data: null, error: null });
    try {
      return Promise.resolve({ data: (h(args) ?? null) as unknown, error: null });
    } catch (e) {
      return Promise.resolve({ data: null, error: { message: (e as Error).message } });
    }
  }

  from(table: string): DbTable {
    return {
      insert: (rows) => new FakeQuery(this, table, 'insert', rows),
      select: (_columns) => new FakeQuery(this, table, 'select'),
      update: (patch) => new FakeQuery(this, table, 'update', patch),
      delete: () => new FakeQuery(this, table, 'delete'),
    };
  }

  auth: AuthApi = {
    getUser: (jwt: string) => {
      const user = this.users[jwt] ?? null;
      const error: DbError | null = user ? null : { message: 'invalid JWT' };
      return Promise.resolve({ data: { user }, error });
    },
    admin: {
      deleteUser: (id: string) => {
        this.deletedUsers.push(id);
        return Promise.resolve({ error: null });
      },
    },
  };
}

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}

/** A fetch that records every request and answers from `respond`. Never touches the network. */
export function recordingFetch(
  respond: (req: RecordedRequest) => Response | Promise<Response>,
): { fetch: FetchFn; calls: RecordedRequest[] } {
  const calls: RecordedRequest[] = [];
  const fetchFn: FetchFn = async (input, init) => {
    const req = new Request(input, init);
    const rec = { url: req.url, method: req.method, headers: req.headers, body: await req.text() };
    calls.push(rec);
    return respond(rec);
  };
  return { fetch: fetchFn, calls };
}

/** A fetch that fails the test if anything calls it. */
export const noNetwork: FetchFn = (input) => {
  throw new Error(`unexpected network call to ${String(input instanceof Request ? input.url : input)}`);
};

/** Build an unsigned JWT-shaped token with the given payload (for iat checks). */
export function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}
