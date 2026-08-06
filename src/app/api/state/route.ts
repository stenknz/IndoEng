import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { loadState, resetState } from "@/lib/services/learnerService";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const state = await loadState(getDb(), user.id);
    return NextResponse.json(state);
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    await resetState(getDb(), user.id);
    return NextResponse.json({ ok: true });
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
}
