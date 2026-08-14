import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { ttsInfo } from "@/lib/services/ttsService";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    return NextResponse.json(await ttsInfo());
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/tts/info]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
