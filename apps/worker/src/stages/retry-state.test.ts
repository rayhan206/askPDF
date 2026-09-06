import { describe, expect, it } from "vitest";

import { hasReachedStage, isFinalAttempt } from "./retry-state.js";

describe("worker retry state", () => {
  it("allows a retry to pass stages that were already checkpointed", () => {
    expect(hasReachedStage(5, 1)).toBe(true);
    expect(hasReachedStage(5, 5)).toBe(true);
    expect(hasReachedStage(4, 5)).toBe(false);
  });

  it("identifies the last configured attempt", () => {
    expect(isFinalAttempt(0, 3)).toBe(false);
    expect(isFinalAttempt(1, 3)).toBe(false);
    expect(isFinalAttempt(2, 3)).toBe(true);
  });
});
