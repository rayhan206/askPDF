import { describe, expect, it } from "vitest";
import { DocumentModel, MessageModel, UserModel } from "./index.js";

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

  it("applies message uniqueness only to populated request and reply identifiers", () => {
    const indexes = MessageModel.schema.indexes();
    const requestIndex = indexes.find(
      ([fields]) => fields.conversationId === 1 && fields.clientRequestId === 1,
    );
    const replyIndex = indexes.find(
      ([fields]) => fields.replyToMessageId === 1 && fields.role === 1,
    );

    expect(requestIndex?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { role: "user", clientRequestId: { $type: "string" } },
    });
    expect(replyIndex?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { role: "assistant", replyToMessageId: { $type: "objectId" } },
    });
  });
});
