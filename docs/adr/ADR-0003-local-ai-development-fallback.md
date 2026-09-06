# ADR 0003 Local AI Development Fallback

## Status

Accepted for local development on 2026-09-06 by direct user instruction to make the complete localhost product operational without an available Gemini credential.

## Context

AskPDF requires Gemini for production embeddings and answer generation. No Gemini or Google application credential exists in the repository, user environment, or machine environment. Without one, uploads reach the worker but cannot become queryable. A credential cannot be fabricated or safely committed.

## Decision

When `NODE_ENV` is not `production`, `GEMINI_API_KEY` is empty, and `AI_LOCAL_FALLBACK=true`, use a built-in deterministic feature-hashing embedding implementation and an extractive answer generator. Extractive answers may only copy sentences from retrieved chunks and must preserve exact page-level citations. No additional provider, network service, model download, or secret is introduced.

When a Gemini key is present, Gemini remains the automatic provider. Production configuration requires `GEMINI_API_KEY` and rejects startup without it; the local fallback cannot silently replace Gemini in production.

## Consequences

Local PDF ingestion, retrieval, questions, and citations remain functional without external credentials. Local answer quality is intentionally limited to extractive evidence and does not equal Gemini generation quality. Embeddings record a distinct `local-feature-hash-v1-*` model identifier, preventing them from being confused with Gemini vectors. Documents processed locally must be explicitly reprocessed after switching to Gemini.

## Security and scalability

Document text remains on the local machine while fallback mode is active. The implementation is deterministic, bounded by the configured embedding dimension and evidence limits, and does not execute document instructions. Production continues to fail closed without Gemini authentication.

## Revisit conditions

Remove or replace the fallback if local development standardizes on an approved model runtime, if parity with production retrieval becomes mandatory, or if evaluation shows that the extractive behavior violates citation or refusal thresholds.
