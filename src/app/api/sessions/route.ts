import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { appendSession } from "@/lib/services/learnerService";
import { z } from "zod";

const bodySchema = z.object({
  id: z.string().uuid(),
  ts: z.number(),
  durationMin: z.number().min(0),
  wordsReviewed: z.number().min(0),
  newWords: z.number().min(0),
  recallRate: z.number().min(0).max(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = bodySchema.parse(await request.json());
    await appendSession(getDb(), user.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
