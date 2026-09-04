import { describe, expect, it } from "vitest";
import { chunkPages, citationExcerptIsValid, reciprocalRankFusion } from "./index.js";

describe("RAG primitives", () => {
  it("creates stable page-aware chunks", () => {
    const first = chunkPages(
      "document",
      1,
      [{ pageNumber: 7, text: "Evidence ".repeat(100) }],
      300,
      50,
    );
    const second = chunkPages(
      "document",
      1,
      [{ pageNumber: 7, text: "Evidence ".repeat(100) }],
      300,
      50,
    );
    expect(first).toEqual(second);
    expect(first.every((chunk) => chunk.pageStart === 7)).toBe(true);
  });

  it("fuses lexical and vector ranks deterministically", () => {
    const result = reciprocalRankFusion([
      { id: "a", vectorRank: 1, score: 0 },
      { id: "b", vectorRank: 2, score: 0 },
      { id: "b", lexicalRank: 1, score: 0 },
    ]);
    expect(result[0]?.id).toBe("b");
  });

  it("requires excerpts to occur in evidence", () => {
    expect(citationExcerptIsValid("A signed digest protects integrity.", "signed digest")).toBe(
      true,
    );
    expect(citationExcerptIsValid("A signed digest protects integrity.", "private secret")).toBe(
      false,
    );
  });
});
