import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPublicUser, renameUser } from "@/lib/services/authService";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { renameSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const user = await getPublicUser(getDb(), (await requireUser(request)).id);
    return NextResponse.json({ user });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/auth/me GET]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser(request);
    const body = await request.json();
    const parsed = renameSchema.parse(body);
    const user = await renameUser(getDb(), auth.id, parsed.name);
    return NextResponse.json({ user });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/auth/me PATCH]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
