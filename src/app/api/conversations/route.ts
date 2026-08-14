import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { upsertConversation } from "@/lib/services/learnerService";
import { z } from "zod";

const messageSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["tutor", "learner", "system"]),
  content: z.string().min(1),
  timestamp: z.number(),
  hint: z.string().optional(),
  translation: z.string().optional(),
});

const bodySchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().optional(),
  startedAt: z.number(),
  messages: z.array(messageSchema),
});

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const body = bodySchema.parse(await request.json());
    await upsertConversation(getDb(), user.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/conversations]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
