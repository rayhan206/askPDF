# ADR 0002 Phone or Email Authentication

## Status

Accepted by direct user instruction on 2026-09-04.

## Context

The original API and data specifications required email and password authentication. The latest direct instruction requires login and registration with either email or phone plus password, without ownership verification.

## Decision

Store exactly one normalized login identifier per account: `email` or `phoneE164`. Registration requires one and only one. Login accepts a single `identifier` field and resolves it after normalization. Phone numbers use strict E.164 formatting. Password hashing, refresh rotation, CSRF protection, neutral credential errors, rate limits, and workspace authorization remain unchanged.

## Consequences

Unverified identifiers may be mistyped or claimed by someone who does not control them. The UI states this limitation, password recovery is unavailable until a verified recovery channel is added, and production operators should enable verification before supporting sensitive or paid workspaces.
