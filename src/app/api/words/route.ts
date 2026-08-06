import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { applyWordResult } from "@/lib/services/learnerService";
import { z } from "zod";

const bodySchema = z.object({ wordId: z.string().min(1).max(80), result: z.enum(["correct", "partial", "wrong"]) });

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = bodySchema.parse(await request.json());
    const word = await applyWordResult(getDb(), user.id, body.wordId, body.result);
    return NextResponse.json(word);
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
