import { describe, expect, it } from "vitest";
import { buildOpenAIMessages, parseTutorReply } from "@/lib/engine/openaiMessages";
import type { ConversationMessage } from "@/lib/types";

const context = {
  level: 0 as const,
  translationMode: "beginner" as const,
  knownWords: ["air", "nasi"],
};

describe("buildOpenAIMessages", () => {
  it("builds system, mapped history, and a final user message", () => {
    const messages: ConversationMessage[] = [
      { id: "1", kind: "tutor", content: "Halo!", timestamp: 1 },
      { id: "2", kind: "learner", content: "Halo!", timestamp: 2 },
    ];
    const out = buildOpenAIMessages({
      messages,
      input: "Nama saya Kawan",
      context,
    });
    expect(out[0].role).toBe("system");
    expect(out).toContainEqual({ role: "assistant", content: "Halo!" });
    expect(out).toContainEqual({ role: "user", content: "Halo!" });
    expect(out[out.length - 1]).toEqual({
      role: "user",
      content: "Nama saya Kawan",
    });
  });

  it("includes learner level, translation mode, and known words in the system prompt", () => {
    const out = buildOpenAIMessages({ messages: [], input: "ya", context });
    expect(out[0].content).toContain("complete beginner");
    expect(out[0].content).toContain("air, nasi");
    expect(out[0].content).toContain("beginner");
  });

  it("caps history to the last 20 messages", () => {
    const messages: ConversationMessage[] = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      kind: (i % 2 === 0 ? "tutor" : "learner") as "tutor" | "learner",
      content: `msg-${i}`,
      timestamp: i,
    }));
    const out = buildOpenAIMessages({ messages, input: "halo", context });
    const history = out.slice(1, -1);
    expect(history).toHaveLength(20);
    expect(history[0].content).toBe("msg-20");
  });
});

describe("parseTutorReply", () => {
  it("parses a JSON reply", () => {
    const r = parseTutorReply(
      '{"text":"Kamu makan apa?","hint":"eat","translation":"What do you eat?"}',
    );
    expect(r.text).toBe("Kamu makan apa?");
    expect(r.hint).toBe("eat");
    expect(r.translation).toBe("What do you eat?");
  });

  it("extracts expectedWords from a JSON reply", () => {
    const r = parseTutorReply(
      '{"text":"Kamu makan apa?","expectedWords":["makan","nasi"],"translation":"What do you eat?"}',
    );
    expect(r.expectedWords).toEqual(["makan", "nasi"]);
  });

  it("ignores malformed expectedWords", () => {
    const r = parseTutorReply('{"text":"Ini air.","expectedWords":"air"}');
    expect(r.text).toBe("Ini air.");
    expect(r.expectedWords).toBeUndefined();
  });


  it("extracts JSON embedded in surrounding text", () => {
    const r = parseTutorReply('Sure! Here is my reply: {"text":"Ini air.","hint":"water"}');
    expect(r.text).toBe("Ini air.");
    expect(r.hint).toBe("water");
  });

  it("falls back to raw text when no JSON is present", () => {
    const r = parseTutorReply("Halo! Selamat datang!");
    expect(r.text).toBe("Halo! Selamat datang!");
    expect(r.hint).toBeUndefined();
  });
});
