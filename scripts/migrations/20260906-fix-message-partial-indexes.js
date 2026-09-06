const messages = db.getCollection("messages");
const existingNames = new Set(messages.getIndexes().map((index) => index.name));

for (const name of ["conversationId_1_clientRequestId_1", "replyToMessageId_1_role_1"]) {
  if (existingNames.has(name)) messages.dropIndex(name);
}

messages.createIndex(
  { conversationId: 1, clientRequestId: 1 },
  {
    name: "conversationId_1_clientRequestId_1",
    unique: true,
    partialFilterExpression: { role: "user", clientRequestId: { $type: "string" } },
  },
);

messages.createIndex(
  { replyToMessageId: 1, role: 1 },
  {
    name: "replyToMessageId_1_role_1",
    unique: true,
    partialFilterExpression: { role: "assistant", replyToMessageId: { $type: "objectId" } },
  },
);
