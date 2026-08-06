"use client";
import { apiFetch } from "@/lib/api/client";
import type { LearnerState, VocabularyWord, PracticeAttempt, LearningSession, Conversation, LearningProfile, LessonStatus } from "@/lib/types";

export function loadStateFromServer(): Promise<LearnerState> { return apiFetch<LearnerState>("/api/state"); }
export function resetStateOnServer(): Promise<{ ok: true }> { return apiFetch("/api/state", { method: "DELETE" }); }
export function saveWordResult(wordId: string, result: "correct" | "partial" | "wrong"): Promise<VocabularyWord> {
  return apiFetch<VocabularyWord>("/api/words", { method: "POST", body: { wordId, result } });
}
export function touchWordOnServer(wordId: string): Promise<VocabularyWord> {
  return apiFetch<VocabularyWord>(`/api/words/${encodeURIComponent(wordId)}/touch`, { method: "POST" });
}
export function saveLessonProgress(lessonId: string, status: LessonStatus): Promise<{ ok: true }> {
  return apiFetch("/api/lessons", { method: "POST", body: { lessonId, status } });
}
export function saveAttempt(a: PracticeAttempt): Promise<{ ok: true }> { return apiFetch("/api/attempts", { method: "POST", body: a }); }
export function saveSession(s: LearningSession): Promise<{ ok: true }> { return apiFetch("/api/sessions", { method: "POST", body: s }); }
export function saveConversation(c: Conversation): Promise<{ ok: true }> { return apiFetch("/api/conversations", { method: "PUT", body: c }); }
export function saveProfile(patch: Partial<LearningProfile>): Promise<{ ok: true }> { return apiFetch("/api/profile", { method: "PATCH", body: patch }); }
export function renameUserOnServer(name: string): Promise<{ user: { id: string; name: string; email: string; role: string } }> {
  return apiFetch("/api/auth/me", { method: "PATCH", body: { name } });
}
