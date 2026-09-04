import { describe, expect, it } from "vitest";
import { AppError, notFound } from "./errors.js";

describe("application errors", () => {
  it("retains the safe public error contract", () => {
    const error = new AppError(409, "STATE_CONFLICT", "The state changed.", [
      { path: "status", issue: "stale" },
    ]);
    expect(error).toMatchObject({
      status: 409,
      code: "STATE_CONFLICT",
      message: "The state changed.",
    });
    expect(error.details).toEqual([{ path: "status", issue: "stale" }]);
  });

  it("creates consistent not-found errors", () => {
    expect(notFound("DOCUMENT_NOT_FOUND", "document")).toMatchObject({
      status: 404,
      code: "DOCUMENT_NOT_FOUND",
      message: "The requested document was not found.",
    });
  });
});
