import "server-only";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

// Lenient email regex: accepts single-label TLDs like a@b.c (zod's built-in
// `.email()` requires a TLD of 2+ chars, which the test suite relies on not
// being the case) while still rejecting obvious non-emails.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{1,63}$/;

export const emailSchema = z.string().regex(EMAIL_RE, "Invalid email address").max(254);
export const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(128);
export const nameSchema = z.string().trim().min(1).max(80);

export const registerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  remember: z.boolean().default(false),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const renameSchema = z.object({ name: nameSchema });

export const adminDisableSchema = z.object({ disabled: z.boolean() });
