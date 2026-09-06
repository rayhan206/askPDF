import { describe, expect, it } from "vitest";

import { buildDeleteJobId, buildIngestJobId } from "./index.js";

describe("BullMQ job identifiers", () => {
  const documentId = "507f1f77bcf86cd799439011";

  it("builds a deterministic ingest identifier without forbidden separators", () => {
    const jobId = buildIngestJobId(documentId, 3);

    expect(jobId).toBe("507f1f77bcf86cd799439011-3");
    expect(jobId).not.toContain(":");
  });

  it("builds a deterministic deletion identifier without forbidden separators", () => {
    const jobId = buildDeleteJobId(documentId);

    expect(jobId).toBe("delete-507f1f77bcf86cd799439011");
    expect(jobId).not.toContain(":");
  });
});
