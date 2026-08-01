import type { LearnerState } from "@/lib/types";

export interface Store {
  getState(): LearnerState;
  setState(partial: Partial<LearnerState>): void;
}
