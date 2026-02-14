/**
 * Shared database client — Single Responsibility: Neon Postgres connection.
 *
 * Eliminates 6× duplicate `getSQL()` definitions across API routes and stores.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

/**
 * Returns a Neon SQL tagged-template client.
 * Lazily created and reused for the process lifetime.
 */
export function getSQL(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  _sql = neon(databaseUrl);
  return _sql;
}
