import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { changePassword } from "@/lib/services/authService";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { changePasswordSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    const body = await request.json();
    const parsed = changePasswordSchema.parse(body);
    await changePassword(getDb(), auth.id, parsed.currentPassword, parsed.newPassword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/auth/change-password]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
