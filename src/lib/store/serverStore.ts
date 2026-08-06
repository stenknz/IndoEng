import type { WordResult } from "@/lib/store/useStore";
import type { LessonStatus } from "@/lib/types";

export function payloadForWordResult(wordId: string, result: WordResult): { wordId: string; result: WordResult } {
  return { wordId, result };
}

export function mapLessonPayload(lessonId: string, status: LessonStatus): { lessonId: string; status: LessonStatus } {
  return { lessonId, status };
}

export function mapResult(result: WordResult): WordResult {
  return result;
}
