import "server-only";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "@/lib/db";

export async function runMigrations(): Promise<void> {
  const db = getDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
}
