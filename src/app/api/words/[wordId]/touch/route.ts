import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { touchWordRow } from "@/lib/services/learnerService";

export async function POST(request: Request, { params }: { params: Promise<{ wordId: string }> }) {
  try {
    const user = await requireUser(request);
    const { wordId } = await params;
    const word = await touchWordRow(getDb(), user.id, wordId);
    return NextResponse.json(word);
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
