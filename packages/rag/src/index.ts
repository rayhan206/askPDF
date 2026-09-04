import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface TextChunk {
  stableChunkId: string;
  ordinal: number;
  text: string;
  lexicalText: string;
  pageStart: number;
  pageEnd: number;
  sourceSpans: Array<{ pageNumber: number; startOffset: number; endOffset: number }>;
  contentHash: string;
  tokenCount: number;
}

export interface RetrievalCandidate {
  id: string;
  vectorRank?: number;
  lexicalRank?: number;
  score: number;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function extractPdfPages(
  path: string,
  maximumPages: number,
): Promise<ExtractedPage[]> {
  const file = await open(path, "r");
  const prefix = Buffer.alloc(5);
  try {
    const { bytesRead } = await file.read(prefix, 0, prefix.length, 0);
    if (bytesRead !== 5 || prefix.toString("ascii") !== "%PDF-")
      throw new Error("UNSUPPORTED_FILE_TYPE");
  } finally {
    await file.close();
  }
  const loadingTask = getDocument({ url: path });
  const document = await loadingTask.promise;
  if (document.numPages < 1) {
    await loadingTask.destroy();
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }
  try {
    if (document.numPages > maximumPages) throw new Error("PROCESSING_REJECTED");
    const pages: ExtractedPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = normalizeText(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" "),
      );
      pages.push({ pageNumber, text });
      page.cleanup();
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

export function chunkPages(
  documentId: string,
  processingVersion: number,
  pages: ExtractedPage[],
  targetCharacters: number,
  overlapCharacters: number,
): TextChunk[] {
  if (targetCharacters < 200 || overlapCharacters >= targetCharacters) {
    throw new Error("Invalid chunk configuration");
  }
  const chunks: TextChunk[] = [];
  for (const page of pages) {
    if (!page.text) continue;
    let start = 0;
    while (start < page.text.length) {
      let end = Math.min(page.text.length, start + targetCharacters);
      if (end < page.text.length) {
        const boundary = page.text.lastIndexOf(" ", end);
        if (boundary > start + Math.floor(targetCharacters * 0.6)) end = boundary;
      }
      const text = page.text.slice(start, end).trim();
      if (text) {
        const ordinal = chunks.length;
        const contentHash = sha256(`${page.pageNumber}:${start}:${end}:${text}`);
        chunks.push({
          stableChunkId: sha256(
            `${documentId}|${processingVersion}|${page.pageNumber}|${ordinal}|${contentHash}`,
          ),
          ordinal,
          text,
          lexicalText: text.toLowerCase(),
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          sourceSpans: [{ pageNumber: page.pageNumber, startOffset: start, endOffset: end }],
          contentHash,
          tokenCount: Math.max(1, Math.ceil(text.length / 4)),
        });
      }
      if (end >= page.text.length) break;
      start = Math.max(start + 1, end - overlapCharacters);
    }
  }
  return chunks;
}

export function reciprocalRankFusion(
  candidates: RetrievalCandidate[],
  constant = 60,
): RetrievalCandidate[] {
  const byId = new Map<string, RetrievalCandidate>();
  for (const candidate of candidates) {
    const existing = byId.get(candidate.id) ?? { id: candidate.id, score: 0 };
    existing.score += candidate.vectorRank ? 1 / (constant + candidate.vectorRank) : 0;
    existing.score += candidate.lexicalRank ? 1 / (constant + candidate.lexicalRank) : 0;
    if (candidate.vectorRank !== undefined) existing.vectorRank = candidate.vectorRank;
    if (candidate.lexicalRank !== undefined) existing.lexicalRank = candidate.lexicalRank;
    byId.set(candidate.id, existing);
  }
  return [...byId.values()].sort(
    (left, right) => right.score - left.score || left.id.localeCompare(right.id),
  );
}

export function citationExcerptIsValid(sourceText: string, excerpt: string): boolean {
  return normalizeText(sourceText).includes(normalizeText(excerpt));
}
