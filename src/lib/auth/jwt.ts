import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { loadConfig } from "@/lib/config";
import { randomBytes } from "crypto";

export const ACCESS_TTL_SECONDS = 15 * 60;

export class JwtError extends Error {}

function secret(): Uint8Array {
  return new TextEncoder().encode(loadConfig().jwtSecret);
}

export async function signAccessToken(payload: { userId: string; role: string }): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .setJti(randomBytes(16).toString("hex"))
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; role: string }> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.role !== "string") throw new Error("bad payload");
    return { userId: payload.userId, role: payload.role };
  } catch {
    throw new JwtError("invalid or expired token");
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}
