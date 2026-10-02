import type { Logger } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkerWakeClient } from "./worker-wake-client.js";

const logger = { warn: vi.fn() } as unknown as Logger;

describe("WorkerWakeClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("does nothing when the worker URL is not configured", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    new WorkerWakeClient(undefined, logger).wake();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests the worker health endpoint without blocking the caller", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    new WorkerWakeClient("https://askpdf-worker.example.com", logger).wake();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe(
      "https://askpdf-worker.example.com/health",
    );
  });
});
