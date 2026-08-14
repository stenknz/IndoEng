import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, HttpError } from "@/lib/auth/requireUser";
import { resetUserPassword } from "@/lib/services/adminService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    await resetUserPassword(getDb(), admin.id, id, body.newPassword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/admin/users/:id/reset-password]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
