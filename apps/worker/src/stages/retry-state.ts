export function hasReachedStage(currentSequence: number, requestedSequence: number): boolean {
  return currentSequence >= requestedSequence;
}

export function isFinalAttempt(
  attemptsMade: number,
  configuredAttempts: number | undefined,
): boolean {
  return attemptsMade + 1 >= (configuredAttempts ?? 1);
}
