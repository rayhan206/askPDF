import { describe, expect, it } from "vitest";
import { DocumentModel, UserModel } from "./index.js";

describe("model indexes", () => {
  it("defines unique account identifiers", () => {
    const indexes = UserModel.schema.indexes();
    expect(indexes.some(([fields, options]) => fields.email === 1 && options.unique === true)).toBe(
      true,
    );
    expect(
      indexes.some(([fields, options]) => fields.phoneE164 === 1 && options.unique === true),
    ).toBe(true);
  });

  it("scopes document list indexes by workspace", () => {
    expect(
      DocumentModel.schema
        .indexes()
        .some(([fields]) => fields.workspaceId === 1 && fields.deletedAt === 1),
    ).toBe(true);
  });
});
