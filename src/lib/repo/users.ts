import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { loadConfig } from "@/lib/config";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "student" | "admin";
  emailVerifiedAt: number | null;
  disabledAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export async function createUser(db: Db, input: { email: string; name: string; passwordHash: string; role?: "student" | "admin"; id?: string }): Promise<UserRow> {
  const now = Date.now();
  const row = {
    id: input.id ?? randomUUID(),
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: input.passwordHash,
    role: input.role ?? "student",
    emailVerifiedAt: null,
    disabledAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(users).values(row);
  return row;
}

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return rows[0] as UserRow | undefined;
}

export async function findUserById(db: Db, id: string): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] as UserRow | undefined;
}

export async function updateUserPassword(db: Db, id: string, hash: string): Promise<void> {
  await db.update(users).set({ passwordHash: hash, updatedAt: Date.now() }).where(eq(users.id, id));
}

export async function setUserDisabled(db: Db, id: string, disabledAt: number | null): Promise<void> {
  await db.update(users).set({ disabledAt, updatedAt: Date.now() }).where(eq(users.id, id));
}

export async function listUsers(db: Db): Promise<UserRow[]> {
  return (await db.select().from(users).orderBy(desc(users.createdAt))) as UserRow[];
}

export async function countUsers(db: Db): Promise<number> {
  const rows = await db.select({ count: sql`count(*)` }).from(users);
  return Number(rows[0]?.count ?? 0);
}

export async function seedAdminIfNeeded(db: Db): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.adminEmail || !cfg.adminPassword) return;
  const existing = await findUserByEmail(db, cfg.adminEmail);
  if (existing) return;
  const { hashPassword } = await import("@/lib/auth/password");
  await createUser(db, { email: cfg.adminEmail, name: "Admin", passwordHash: await hashPassword(cfg.adminPassword), role: "admin" });
}
