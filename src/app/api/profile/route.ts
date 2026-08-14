import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { updateProfile } from "@/lib/services/learnerService";
import { z } from "zod";

const bodySchema = z.object({
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  translationMode: z.enum(["beginner", "intermediate", "advanced"]),
  pronunciationOn: z.boolean(),
  aiTutorOn: z.boolean(),
  vocabKnowledge: z.number().min(0).max(100),
  grammarKnowledge: z.number().min(0).max(100),
  conversationAbility: z.number().min(0).max(100),
  readingAbility: z.number().min(0).max(100),
  listeningAbility: z.number().min(0).max(100),
  recentMistakes: z.array(z.number()),
  confidence: z.number().min(0).max(1),
  currentDifficulty: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  lastAnswerAccuracy: z.number().min(0).max(1),
  consecutiveCorrect: z.number().int().min(0),
}).partial();

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const body = bodySchema.parse(await request.json());
    await updateProfile(getDb(), user.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/profile]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
