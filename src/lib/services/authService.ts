import "server-only";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { refreshTokens, profiles } from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { HttpError } from "@/lib/auth/requireUser";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken, generateRefreshToken } from "@/lib/auth/jwt";
import { hashToken } from "@/lib/auth/session";
import { loadConfig } from "@/lib/config";
import { createUser, findUserByEmail, findUserById, updateUserPassword } from "@/lib/repo/users";
import { createProfileIfMissing } from "@/lib/repo/learner";
import { createRefreshTokenRow, findRefreshTokenRow, revokeRefreshTokenRow, revokeAllUserTokens } from "@/lib/repo/authTokens";
import { registerSchema, loginSchema, changePasswordSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

export interface PublicUser { id: string; email: string; name: string; role: "student" | "admin"; createdAt: number; disabledAt: number | null; }
export interface AuthSession { accessToken: string; refreshToken: string; user: PublicUser; refreshMaxAgeSeconds: number; }

function parseOr400<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new HttpError(400, "Invalid input");
  return r.data;
}

function toPublic(row: { id: string; email: string; name: string; role: string; createdAt: number; disabledAt: number | null }): PublicUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role === "admin" ? "admin" : "student", createdAt: row.createdAt, disabledAt: row.disabledAt };
}

async function issueSession(db: Db, user: { id: string; email: string; name: string; role: "student" | "admin"; createdAt: number; disabledAt: number | null }, remember: boolean, meta: { ip?: string; ua?: string }): Promise<AuthSession> {
  const cfg = loadConfig();
  const refreshToken = generateRefreshToken();
  const refreshTtlSeconds = (remember ? cfg.rememberTtlDays : cfg.sessionTtlHours / 24) * 86400;
  await createRefreshTokenRow(db, {
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: Date.now() + refreshTtlSeconds * 1000,
    userAgent: meta.ua ?? null,
    ip: meta.ip ?? null,
    createdAt: Date.now(),
  });
  return {
    accessToken: await signAccessToken({ userId: user.id, role: user.role }),
    refreshToken,
    user: toPublic(user),
    refreshMaxAgeSeconds: refreshTtlSeconds,
  };
}

export async function register(db: Db, input: { email: string; name: string; password: string }): Promise<AuthSession> {
  const parsed = parseOr400(registerSchema, input);
  if (await findUserByEmail(db, parsed.email)) throw new HttpError(409, "Email already registered");
  const user = await createUser(db, { email: parsed.email, name: parsed.name, passwordHash: await hashPassword(parsed.password) });
  await createProfileIfMissing(db, user.id);
  return issueSession(db, user, false, {});
}

export async function login(db: Db, input: { email: string; password: string; remember: boolean }): Promise<AuthSession> {
  const parsed = parseOr400(loginSchema, input);
  const user = await findUserByEmail(db, parsed.email);
  if (!user || user.disabledAt) throw new HttpError(401, "Invalid email or password");
  const ok = await verifyPassword(parsed.password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid email or password");
  return issueSession(db, user, parsed.remember, {});
}

export async function refreshSession(db: Db, refreshToken: string, meta: { ip?: string; ua?: string }): Promise<AuthSession> {
  if (!refreshToken) throw new HttpError(401, "Missing refresh token");
  const row = await findRefreshTokenRow(db, hashToken(refreshToken));
  if (!row) throw new HttpError(401, "Invalid refresh token");
  // A token whose row already carries a replacement is a REUSED (replayed)
  // token: the session family is compromised, so revoke every row for the user.
  if (row.replacedById) {
    await revokeAllUserTokens(db, row.userId);
    throw new HttpError(401, "Invalid refresh token");
  }
  if (row.expiresAt < Date.now()) throw new HttpError(401, "Refresh token expired");
  const user = await findUserById(db, row.userId);
  if (!user || user.disabledAt) throw new HttpError(401, "Invalid refresh token");
  const next = generateRefreshToken();
  // Rotate onto a NEW row and mark the consumed row as replaced (its
  // replacedById points at the fresh row). A request that later presents the
  // rotated-out token finds a row whose replacedById is already set — that is
  // a replayed token, so the whole family is revoked. The original expiry is
  // kept, so a remember-me session is not collapsed to the session TTL on the
  // first refresh. Consumed marker rows accumulate per active session —
  // bounded by the refresh cadence × token lifetime — and are deleted
  // wholesale by revokeAllUserTokens.
  const newRowId = randomUUID();
  await createRefreshTokenRow(db, {
    id: newRowId,
    userId: user.id,
    tokenHash: hashToken(next),
    expiresAt: row.expiresAt,
    userAgent: meta.ua ?? null,
    ip: meta.ip ?? null,
    createdAt: Date.now(),
  });
  await db.update(refreshTokens).set({ replacedById: newRowId }).where(eq(refreshTokens.id, row.id));
  return {
    accessToken: await signAccessToken({ userId: user.id, role: user.role }),
    refreshToken: next,
    user: toPublic(user),
    refreshMaxAgeSeconds: Math.max(1, Math.floor((row.expiresAt - Date.now()) / 1000)),
  };
}

export async function revokeSession(db: Db, refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  await revokeRefreshTokenRow(db, hashToken(refreshToken));
}

export async function changePassword(db: Db, userId: string, current: string, next: string): Promise<void> {
  const parsed = parseOr400(changePasswordSchema, { currentPassword: current, newPassword: next });
  const user = await findUserById(db, userId);
  if (!user) throw new HttpError(401, "Not authenticated");
  const ok = await verifyPassword(parsed.currentPassword, user.passwordHash);
  if (!ok) throw new HttpError(400, "Current password is incorrect");
  await updateUserPassword(db, userId, await hashPassword(parsed.newPassword));
  await revokeAllUserTokens(db, userId);
}

export async function renameUser(db: Db, userId: string, name: string): Promise<PublicUser> {
  const { nameSchema } = await import("@/lib/validation/schemas");
  const parsed = parseOr400(nameSchema, name);
  const { users } = await import("@/lib/db/schema");
  await db.update(users).set({ name: parsed, updatedAt: Date.now() }).where(eq(users.id, userId));
  const row = await findUserById(db, userId);
  if (!row) throw new HttpError(401, "Not authenticated");
  return toPublic(row);
}

export async function getPublicUser(db: Db, userId: string): Promise<PublicUser> {
  const row = await findUserById(db, userId);
  if (!row) throw new HttpError(401, "Not authenticated");
  return toPublic(row);
}
