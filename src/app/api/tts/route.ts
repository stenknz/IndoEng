import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { synthesize, getPiperVoices } from "@/lib/services/ttsService";

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const body = bodySchema.parse(await request.json());
    if (body.voice !== undefined) {
      const voices = await getPiperVoices();
      if (!voices.some((v) => v.id === body.voice)) {
        return NextResponse.json({ error: "Unknown voice" }, { status: 400 });
      }
    }
    const audio = await synthesize(body.text, body.voice);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/tts]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
