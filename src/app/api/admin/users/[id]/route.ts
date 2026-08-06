import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, HttpError } from "@/lib/auth/requireUser";
import { setUserDisabled } from "@/lib/services/adminService";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const user = await setUserDisabled(getDb(), admin.id, id, body.disabled);
    return NextResponse.json(user);
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
