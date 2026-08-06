import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, HttpError } from "@/lib/auth/requireUser";
import { listUsersPublic } from "@/lib/services/adminService";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const users = await listUsersPublic(getDb());
    return NextResponse.json(users);
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
