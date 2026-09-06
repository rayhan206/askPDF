import { describe, expect, it } from "vitest";

import { LocalDevelopmentAiProvider, createAiProvider } from "./index.js";

describe("local development AI provider", () => {
  it("creates deterministic normalized embeddings", async () => {
    const provider = new LocalDevelopmentAiProvider(16);

    const [first, second] = await provider.embed([
      "Revenue increased in 2025.",
      "Revenue increased in 2025.",
    ]);

    expect(first).toEqual(second);
    expect(first).toHaveLength(16);
    expect(Math.sqrt((first ?? []).reduce((total, value) => total + value * value, 0))).toBeCloseTo(
      1,
    );
  });

  it("returns evidence text with an exact page citation", async () => {
    const provider = new LocalDevelopmentAiProvider(16);

    const answer = await provider.answer("How did revenue change?", [
      {
        chunkId: "507f1f77bcf86cd799439011",
        documentName: "report.pdf",
        pageNumber: 7,
        text: "Revenue increased by twelve percent during the reporting period.",
      },
    ]);

    expect(answer.claims[0]).toEqual({
      id: "claim-1",
      text: "Revenue increased by twelve percent during the reporting period.",
      citations: [
        {
          chunkId: "507f1f77bcf86cd799439011",
          pageNumber: 7,
          excerpt: "Revenue increased by twelve percent during the reporting period.",
        },
      ],
    });
  });

  it("refuses to create a provider without credentials or an allowed fallback", () => {
    expect(() =>
      createAiProvider({
        apiKey: "",
        embeddingModel: "gemini-embedding-001",
        generationModel: "gemini-2.5-flash",
        embeddingDimension: 768,
        timeoutMs: 30_000,
        allowLocalFallback: false,
      }),
    ).toThrow("GEMINI_API_KEY is required");
  });
});
