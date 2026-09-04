import { describe, expect, it } from "vitest";
import { documentIngestJobSchema, registerRequestSchema } from "./index.js";

describe("contracts", () => {
  it("requires exactly one login identifier", () => {
    expect(
      registerRequestSchema.safeParse({
        displayName: "Asha",
        password: "a-secure-password",
        email: "asha@example.com",
      }).success,
    ).toBe(true);
    expect(
      registerRequestSchema.safeParse({
        displayName: "Asha",
        password: "a-secure-password",
        email: "asha@example.com",
        phone: "+919876543210",
      }).success,
    ).toBe(false);
  });

  it("rejects document text in queue payloads", () => {
    expect(
      documentIngestJobSchema.safeParse({
        schemaVersion: 1,
        documentId: "66d8a1f5213baf07a6e10200",
        processingVersion: 1,
        processingRunId: "66d8a1f5213baf07a6e10201",
        correlationId: "request-1",
        text: "secret",
      }).success,
    ).toBe(false);
  });
});
