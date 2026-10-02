import type { Logger } from "pino";

const WAKE_TIMEOUT_MS = 5_000;

export class WorkerWakeClient {
  constructor(
    private readonly workerPublicUrl: string | undefined,
    private readonly logger: Logger,
  ) {}

  wake(): void {
    if (!this.workerPublicUrl) return;
    const healthUrl = new URL("/health", this.workerPublicUrl);
    void fetch(healthUrl, { signal: AbortSignal.timeout(WAKE_TIMEOUT_MS) })
      .then((response) => {
        if (!response.ok) {
          this.logger.warn({ statusCode: response.status }, "worker wake request was rejected");
        }
      })
      .catch((error: unknown) => {
        this.logger.warn({ err: error }, "worker wake request did not complete");
      });
  }
}
