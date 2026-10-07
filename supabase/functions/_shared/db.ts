/**
 * The narrow slice of the supabase-js client the functions use. Handlers
 * depend on this interface only, so tests can pass the in-memory fake in
 * `_shared/testing.ts` and the real client is plugged in by `index.ts`.
 */

export interface DbError {
  message: string;
  code?: string;
}

export interface DbResult<T = unknown> {
  data: T | null;
  error: DbError | null;
}

export interface DbQuery extends PromiseLike<DbResult> {
  select(columns?: string): DbQuery;
  eq(column: string, value: unknown): DbQuery;
  is(column: string, value: null | boolean): DbQuery;
  in(column: string, values: readonly unknown[]): DbQuery;
  order(column: string, options?: { ascending?: boolean }): DbQuery;
  limit(count: number): DbQuery;
  maybeSingle(): PromiseLike<DbResult>;
}

export interface DbTable {
  insert(rows: Record<string, unknown> | Record<string, unknown>[]): DbQuery;
  select(columns?: string): DbQuery;
  update(patch: Record<string, unknown>): DbQuery;
  delete(): DbQuery;
}

export interface AuthUser {
  id: string;
  phone?: string;
}

export interface AuthApi {
  getUser(jwt: string): Promise<{ data: { user: AuthUser | null }; error: DbError | null }>;
  admin: {
    deleteUser(id: string): Promise<{ error: DbError | null }>;
  };
}

export interface DbClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<DbResult>;
  from(table: string): DbTable;
  auth: AuthApi;
}

/** Call an RPC and throw on error, so handlers can use plain try/catch. */
export async function rpc<T = unknown>(db: DbClient, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Env vars as a plain record (Deno.env.toObject() in production). */
export type Env = Record<string, string | undefined>;
