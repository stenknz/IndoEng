import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { appendAttempt } from "@/lib/services/learnerService";
import { z } from "zod";

const bodySchema = z.object({
  id: z.string().uuid(),
  ts: z.number(),
  kind: z.enum(["lesson", "conversation", "recall", "vocab"]),
  prompt: z.string().min(1),
  learnerAnswer: z.string().min(1),
  expected: z.string().min(1),
  correct: z.union([z.boolean(), z.literal("partial")]),
  wordIds: z.array(z.string().min(1)),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = bodySchema.parse(await request.json());
    await appendAttempt(getDb(), user.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
