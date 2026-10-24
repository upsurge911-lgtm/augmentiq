# AugmentIQ Security & Data Ownership

**Status:** DRAFT v0.1

## The 5 Immutable Principles (the constitution)

1. **We don't own your memory.** Every state-changing action needs explicit per-action confirmation.
2. **We don't own your agent.** The host agent retains full authority. The skill suggests, you decide.
3. **Your data is yours, forever.** Every action is reversible. Migration is bidirectional. No lock-in.
4. **Confirm before destructive.** Delete, redact, expire, migrate, destroy — all need in-session confirmation, with pre-destroy export offered.
5. **Audit everything.** Every state change is logged to an append-only, content-hashed, tamper-evident timeline you can export.

## Security properties

| Property | Detail |
|---|---|
| Classification | Every record: `public` / `internal` / `confidential` / `restricted`, with PII auto-upgrade |
| Tamper-evident audit | Hash-chained timeline; server-owned when the AugmentIQ+ backend is in use |
| Retention packs | GDPR, SOC2, HIPAA, ISO 27001 (ship in v0.1.1) |
| Local-only storage | AugmentIQ+ runs in Docker on your machine; the Obsidian plugin binds to `127.0.0.1` only. No cloud. No telemetry. No data leaves the host. |
| Consumer plugin transport | Loopback HTTP with auto-generated bearer-token auth; read-only mode available |
| Safe deletion | Vault deletions go to trash, never hard delete |

Full principle spec with mechanisms and citations: [`references/PRINCIPLES.md`](../../references/PRINCIPLES.md)