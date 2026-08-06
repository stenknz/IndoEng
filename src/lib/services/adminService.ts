import "server-only";
import { HttpError } from "@/lib/auth/requireUser";
import type { Db } from "@/lib/db";
import { listUsers, findUserById, setUserDisabled as setDisabled, updateUserPassword } from "@/lib/repo/users";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllUserTokens } from "@/lib/repo/authTokens";
import type { PublicUser } from "@/lib/services/authService";

function toPublic(u: { id: string; email: string; name: string; role: string; createdAt: number; disabledAt: number | null }): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role === "admin" ? "admin" : "student", createdAt: u.createdAt, disabledAt: u.disabledAt };
}

export async function listUsersPublic(db: Db): Promise<PublicUser[]> {
  const rows = await listUsers(db);
  return rows.map(toPublic);
}

export async function setUserDisabled(db: Db, adminId: string, userId: string, disabled: boolean): Promise<PublicUser> {
  if (adminId === userId) throw new HttpError(400, "You cannot disable your own account");
  const target = await findUserById(db, userId);
  if (!target) throw new HttpError(404, "User not found");
  await setDisabled(db, userId, disabled ? Date.now() : null);
  if (disabled) await revokeAllUserTokens(db, userId);
  return toPublic({ ...target, disabledAt: disabled ? Date.now() : null });
}

export async function resetUserPassword(db: Db, adminId: string, userId: string, newPassword: string): Promise<void> {
  if (adminId === userId) throw new HttpError(400, "Use 'change password' for your own account");
  const target = await findUserById(db, userId);
  if (!target) throw new HttpError(404, "User not found");
  if (newPassword.length < 8) throw new HttpError(400, "New password must be at least 8 characters");
  await updateUserPassword(db, userId, await hashPassword(newPassword));
  await revokeAllUserTokens(db, userId);
}

export { listUsersPublic as listUsers };
