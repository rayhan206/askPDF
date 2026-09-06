# Message partial-index migration

## Purpose

The original sparse unique indexes included explicit `null` values, so a second user question or assistant response could fail with MongoDB error `E11000`. The corrected indexes apply uniqueness only when the relevant identifier has its real BSON type.

## Apply

Back up the database, then run the idempotent migration against each environment before deploying the API change:

```powershell
mongosh $env:MONGODB_URI --file scripts/migrations/20260906-fix-message-partial-indexes.js
```

The migration drops and recreates only these indexes:

- `conversationId_1_clientRequestId_1`
- `replyToMessageId_1_role_1`

It does not update or delete message documents.

## Verify

Run `db.messages.getIndexes()` and confirm both indexes have a `partialFilterExpression` and do not have `sparse: true`. Then create two questions in the same conversation and confirm each receives one assistant reply.

## Rollback

Rollback is not recommended because the former definitions prevent normal multi-message conversations. If application rollback is required, leave the corrected indexes in place; they preserve the intended uniqueness constraints and are compatible with the previous application code.
