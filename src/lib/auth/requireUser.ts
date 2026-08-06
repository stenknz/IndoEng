import "server-only";
import { findUserById } from "@/lib/repo/users";
import { getDb } from "@/lib/db";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
  disabledAt: number | null;
}

export async function requireUser(request: Request): Promise<AuthUser> {
  const id = request.headers.get("x-user-id");
  if (!id) throw new HttpError(401, "Not authenticated");
  const row = await findUserById(getDb(), id);
  if (!row || row.disabledAt) throw new HttpError(401, "Not authenticated");
  return { id: row.id, email: row.email, name: row.name, role: row.role, disabledAt: row.disabledAt };
}

export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireUser(request);
  if (user.role !== "admin") throw new HttpError(403, "Admin role required");
  return user;
}
