import { describe, it, expect } from "vitest";
import {
  mapResult,
  payloadForWordResult,
  mapLessonPayload,
} from "@/lib/store/serverStore";

describe("store server mappings", () => {
  it("maps SRS results to payloads", () => {
    expect(payloadForWordResult("word_1", "correct")).toEqual({
      wordId: "word_1",
      result: "correct",
    });
  });
  it("maps lesson progress", () => {
    expect(mapLessonPayload("lesson_1", "complete")).toEqual({
      lessonId: "lesson_1",
      status: "complete",
    });
  });
  it("passes SRS results through", () => {
    expect(mapResult("partial")).toBe("partial");
    expect(mapResult("wrong")).toBe("wrong");
  });
});
