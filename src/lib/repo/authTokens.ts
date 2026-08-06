import "server-only";
import { and, eq } from "drizzle-orm";
import { refreshTokens } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  replacedById?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  createdAt: number;
}

export async function createRefreshTokenRow(db: Db, row: RefreshTokenRow): Promise<void> {
  await db.insert(refreshTokens).values({ ...row, replacedById: row.replacedById ?? null, userAgent: row.userAgent ?? null, ip: row.ip ?? null });
}

export async function findRefreshTokenRow(db: Db, tokenHash: string): Promise<RefreshTokenRow | undefined> {
  const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
  return rows[0] as RefreshTokenRow | undefined;
}

export async function rotateRefreshTokenRow(db: Db, id: string, newHash: string, newExpiresAt: number): Promise<void> {
  await db.update(refreshTokens).set({ tokenHash: newHash, expiresAt: newExpiresAt }).where(eq(refreshTokens.id, id));
}

export async function revokeRefreshTokenRow(db: Db, tokenHash: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function revokeAllUserTokens(db: Db, userId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}
