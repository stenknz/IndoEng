import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { buildOpenAIMessages, parseTutorReply } from "@/lib/engine/openaiMessages";
import { buildTutorContext } from "@/lib/services/learnerService";
import type { ConversationMessage } from "@/lib/types";

export const runtime = "nodejs";

function getConfig() {
  return {
    apiKey: process.env.OPENCODE_GO_API_KEY ?? "",
    baseUrl: (process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1").replace(/\/+$/, ""),
    model: process.env.OPENCODE_GO_MODEL ?? "deepseek-v4-flash",
  };
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(getConfig().apiKey) });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { apiKey, baseUrl, model } = getConfig();
    if (!apiKey) return NextResponse.json({ error: "OPENCODE_GO_API_KEY not configured" }, { status: 501 });

    let body: { messages: ConversationMessage[]; input: string };
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
    if (!Array.isArray(body.messages) || typeof body.input !== "string") {
      return NextResponse.json({ error: "Missing messages or input" }, { status: 400 });
    }

    const context = await buildTutorContext(getDb(), user.id);
    const llmMessages = buildOpenAIMessages({ messages: body.messages, input: body.input, context });

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: llmMessages, temperature: 0.7, max_tokens: 2048 }),
      });
      if (!res.ok) return NextResponse.json({ error: `Provider error ${res.status}` }, { status: 502 });
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content ?? "";
      return NextResponse.json(parseTutorReply(content));
    } catch {
      return NextResponse.json({ error: "Failed to reach provider" }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
