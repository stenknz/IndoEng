import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { newDb, replaceQueryArgs$ } from "pg-mem";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { __setDbForTests } from "@/lib/db";

export async function createTestDb(): Promise<Db> {
  const mem = newDb();
  const migrationDir = path.join(process.cwd(), "drizzle");
  const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migrationDir, f), "utf8").replace(/--> statement-breakpoint/g, "");
    mem.public.none(sql);
  }
  const pool = {
    query: async (config: unknown, values?: unknown[]) => {
      const text = typeof config === "string" ? config : (config as { text: string }).text;
      const params = typeof config === "string" ? (values ?? []) : ((config as { values?: unknown[] }).values ?? values ?? []);
      const rowMode = typeof config === "string" ? undefined : (config as { rowMode?: "array" }).rowMode;
      const res = await mem.public.query(replaceQueryArgs$(text, params));
      if (rowMode === "array") {
        const fieldNames = res.fields.map((f: { name: string }) => f.name);
        return { ...res, rows: res.rows.map((row: Record<string, unknown>) => fieldNames.map((n) => row[n])) };
      }
      return res;
    },
    end: async () => {},
  };
  const db = drizzle(pool as never, { schema }) as unknown as Db;
  __setDbForTests(db);
  return db;
}

export async function dropTestDb(_db: Db): Promise<void> {
  __setDbForTests(null);
  return Promise.resolve();
}

export async function createTestUser(db: Db, id?: string, email?: string): Promise<string> {
  const userId = id ?? randomUUID();
  const now = Date.now();
  await db.insert(schema.users).values({
    id: userId,
    email: email ?? `user-${userId}@example.com`,
    name: "Test User",
    passwordHash: "test-hash",
    createdAt: now,
    updatedAt: now,
  });
  return userId;
}
