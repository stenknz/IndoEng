import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { setLessonProgress } from "@/lib/services/learnerService";
import { z } from "zod";

const bodySchema = z.object({
  lessonId: z.string().min(1).max(120),
  status: z.enum(["not_started", "in_progress", "complete"]),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = bodySchema.parse(await request.json());
    await setLessonProgress(getDb(), user.id, body.lessonId, body.status);
    return NextResponse.json({ ok: true });
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
