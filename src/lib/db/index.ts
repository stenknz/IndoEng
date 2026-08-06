import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";
import { loadConfig } from "@/lib/config";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let db: Db | null = null;
let pool: Pool | null = null;

export function getDb(): Db {
  if (db) return db;
  const cfg = loadConfig();
  pool = new Pool({ connectionString: cfg.databaseUrl, max: 10 });
  db = drizzle(pool, { schema });
  return db;
}

export function getPool(): Pool {
  if (!pool) getDb();
  return pool!;
}

/** Test-only override. */
export function __setDbForTests(next: Db | null): void {
  db = next;
  pool = null;
}
