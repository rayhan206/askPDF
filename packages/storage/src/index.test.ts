import { describe, expect, it } from "vitest";

import { ObjectStorage } from "./index.js";

describe("ObjectStorage", () => {
  it("signs every header required by a browser upload", async () => {
    const storage = new ObjectStorage({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      bucket: "askpdf-private",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      forcePathStyle: true,
    });

    try {
      const uploadUrl = await storage.createUploadUrl(
        "workspaces/workspace-id/documents/document-id/source.pdf",
        "application/pdf",
        "a".repeat(64),
        900,
      );
      const parsedUrl = new URL(uploadUrl);

      expect(parsedUrl.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual([
        "content-type",
        "host",
        "x-amz-meta-sha256",
      ]);
      expect(parsedUrl.searchParams.has("x-amz-meta-sha256")).toBe(false);
    } finally {
      storage.destroy();
    }
  });
});
