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

  it("turns evidence into a readable answer with an exact page citation", async () => {
    const provider = new LocalDevelopmentAiProvider(16);

    const answer = await provider.answer("How did revenue change?", [
      {
        chunkId: "507f1f77bcf86cd799439011",
        documentName: "report.pdf",
        pageNumber: 7,
        text: "Revenue increased by twelve percent during the reporting period.",
      },
    ]);

    expect(answer.claims[0]?.text).toBe(
      "**Answer**\n\nRevenue increased by twelve percent during the reporting period.",
    );
    expect(answer.claims[0]?.citations).toEqual([
      {
        chunkId: "507f1f77bcf86cd799439011",
        pageNumber: 7,
        excerpt: "Revenue increased by twelve percent during the reporting period.",
      },
    ]);
  });

  it("connects a direct finding to its stated cause instead of dumping a raw chunk", async () => {
    const provider = new LocalDevelopmentAiProvider(16);

    const answer = await provider.answer("How did revenue change and what caused it?", [
      {
        chunkId: "507f1f77bcf86cd799439015",
        documentName: "askpdf-revenue-report.pdf",
        pageNumber: 1,
        text: "Revenue Report Revenue increased by twelve percent. The increase was driven by subscription renewals.",
      },
    ]);

    expect(answer.claims[0]?.text).toBe(
      "**Answer**\n\nRevenue increased by twelve percent.\n\n**Supporting details**\n\n- The increase was driven by subscription renewals.",
    );
  });

  it("removes slide noise and connects a topic to its supporting explanation", async () => {
    const provider = new LocalDevelopmentAiProvider(16);

    const answer = await provider.answer("what is hill cpher", [
      {
        chunkId: "507f1f77bcf86cd799439012",
        documentName: "cryptography.pdf",
        pageNumber: 38,
        text: "Polyalphabetic Substitution • In polyalphabetic substitution, each occurrence of a character may have a different substitute. • The relationship between a character in the plaintext to a character in the ciphertext is one-to-many. • Polyalphabetic ciphers hide the letter frequency of the underlying language. • Examples: Playfair Cipher, Hill Cipher, Vigenere Cipher Cryptography and Network Security 38",
      },
      {
        chunkId: "507f1f77bcf86cd799439013",
        documentName: "cryptography.pdf",
        pageNumber: 2,
        text: "Outline • Caesar Cipher • Hill Cipher • Vigenere Cipher Cryptography and Network Security 2",
      },
      {
        chunkId: "507f1f77bcf86cd799439014",
        documentName: "cryptography.pdf",
        pageNumber: 4,
        text: "Symmetric Cipher Model • This section describes the plaintext and the secret key used by the model.",
      },
    ]);

    expect(answer.claims).toHaveLength(1);
    expect(answer.claims[0]?.text).toContain(
      "The document presents **Hill Cipher** as an example of **Polyalphabetic Substitution**.",
    );
    expect(answer.claims[0]?.text).toContain("**What that means in the document**");
    expect(answer.claims[0]?.text).not.toContain("Outline");
    expect(answer.claims[0]?.text).not.toContain("Cryptography and Network Security 38");
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
