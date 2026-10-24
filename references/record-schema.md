---
type: reference
status: ACTIVE — canonical schemas (v0.1)
created: 2026-07-18 (contract locked 2026-07-18T18:45; doc authored 2026-10-24)
author: AugmentIQ team
applies_to: all backends; normative for the Custom backend (AugmentIQ+ via MCP)
tags: [augmentiq, schema, record, timeline, mcp, tools, errors, v0.1]
---

# The AugmentIQ Schemas — Record · Timeline · Tools · Errors

> **What this is.** The canonical types: §1 the AugmentIQ Context Record, §2 the Timeline entry, §3 the 5 MCP tool signatures, §4 the JSON-RPC 2.0 error codes. The Skill formats these types. The Custom backend (AugmentIQ+ via MCP) stores and verifies them. The 4 secondary backends map them onto their native shapes (see `references/backends/<name>.md`).
>
> **What this is not.** Not the launch/handshake/troubleshooting wiring — that's `references/mcp-integration.md`. Not the per-backend behavior — that's `references/backends/<name>.md`.

## 1. The AugmentIQ Context Record

| Field | Type | Required | Set by | Description |
|---|---|---|---|---|
| `schema_version` | string | yes | Skill | `"1.0"`. Bump on breaking change. |
| `id` | string | yes | Skill (before add) | `augmentiq:<uuid-v4>`. |
| `timestamp` | ISO 8601 | yes | Skill | **Event time** — when the fact happened, not when it was recorded. |
| `scope` | enum | yes | config | `individual \| team \| department \| organisation`. |
| `source` | string | yes | Skill | `source_type:source_id:source_internal_id`. |
| `content` | string | yes | Skill | The actual content. |
| `tags` | string[] | no | Skill | Lowercase, consistent (`finance`, `preference`). |
| `classification` | enum | yes | Skill (PII auto-upgrade) | `public \| internal \| confidential \| restricted`. Any PII pattern hit forces ≥ confidential. |
| `retention_policy` | object | no | config / agent | `{ "days": 2555, "until": "...", "action_on_expiry": "archive\|delete" }`. |
| `audit_ref` | string | yes | Skill | `augmentiq-tl:<uuid-v4>` — the timeline entry id for this write. |
| `provenance` | object | no | Skill | `{ "source_system": "...", <source-specific fields> }`. |
| `pii_patterns` | string[] | no | Skill | Matched PII pattern ids (per `references/pii-patterns.md`). |
| `embedding` | float[] | null | Server | **Always null from the Skill.** The server computes embeddings internally. |
| `embedding_ref` | string | null | Server | Server-set reference to the stored vector. |
| `recorded_at` | ISO 8601 | — | Server (set at write) | The second bi-temporal axis: when the server stored it. |

**Bi-temporal rule:** `timestamp` (event time) and `recorded_at` (record time) are distinct. Legacy ingest preserves the original source timestamp in `timestamp`; the server stamps `recorded_at`. Never conflate them.

**Example** (as sent to `mcp_add_memory`):

```json
{
  "schema_version": "1.0",
  "id": "augmentiq:9c1f2a34-...",
  "timestamp": "2026-10-24T14:00:00Z",
  "scope": "individual",
  "source": "chat:session:2026-10-24",
  "content": "User prefers concise answers.",
  "tags": ["preference", "communication"],
  "classification": "internal",
  "retention_policy": { "days": 2555, "action_on_expiry": "archive" },
  "audit_ref": "augmentiq-tl:4e8b1c22-...",
  "provenance": { "source_system": "host_agent_chat" },
  "pii_patterns": [],
  "embedding": null,
  "embedding_ref": null
}
```

## 2. The Timeline entry

Every state change writes exactly one timeline entry. For the Custom backend the timeline is **server-owned**: the server's tamper-evident SQLite table IS the timeline (the Skill keeps no local `timeline.jsonl`).

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | `augmentiq-tl:<uuid-v4>`. |
| `timestamp` | ISO 8601 | yes | Event time of the state change. |
| `action` | string | yes | Action name: `init`, `save`, `snapshot`, `tag`, `redact`, `retention_enforce`, `destroy`, `migrate`, `dsr_erasure`, `ingest_batch`, `repair`, ... |
| `actor` | string | yes | `user:<name>` \| `agent:<host>` \| `cron:<cadence>`. |
| `record_id` | string | yes | The affected `augmentiq:<uuid-v4>` (or `*` for global actions like `init`). |
| `audit_hash` | sha256 | yes | Hash of this entry's canonical serialization. |
| `previous_hash` | sha256 \| `genesis` | yes | The prior entry's `audit_hash` (`genesis` for the first entry). |
| `request_id` | string | yes | Correlation id for the originating request. |

**Chain rule:** entry N's `audit_hash = sha256(canonical(entry N))`, where the canonical serialization includes entry N-1's `audit_hash` as `previous_hash`. Verification recomputes forward and compares. The Skill reads entries back with `mcp_get_audit_entry` (see `references/mcp-integration.md` §1.5).

## 3. The 5 MCP tool signatures (Custom backend)

Full wiring — launch, handshake, per-command flow, teardown — is in `references/mcp-integration.md`. The signatures:

| Tool | When | Key arguments | Returns |
|---|---|---|---|
| `mcp_add_memory` | every `save` / `snapshot` / ingest write | `record` (§1), `audit_hash`, `request_id` | `{ record_id, status, recorded_at }` |
| `mcp_search_memory` | every `recall` / `who-knows` / `timeline` / `audit` query | `query` (may be `""` with a filter), `scope?`, `filters?` (classification, tags, timestamp_range, source, action), `limit?` | `{ records: [...], total, request_id }` |
| `mcp_update_memory` | every `tag` / `redact` / `retention --enforce` write | `record_id`, `updates` (tags, classification, `redacted: true`, `retention_until`), `audit_hash` | `{ status, updated_at }` |
| `mcp_delete_memory` | `destroy --wipe-data`, `dsr --type=erasure` | `record_id`, `delete_type`: `redact \| destroy \| erasure` | `{ status, deleted_at }` |
| `mcp_get_audit_entry` | `audit --verify-chain`, per-record verification | `record_id` | timeline entry fields (§2) |

**Delete types:** `redact` — content replaced with `[REDACTED — <reason> on <timestamp>]`, audit hash preserved. `destroy` — content removed entirely, audit hash preserved. `erasure` — same as destroy, tagged with the GDPR Art. 17 basis (used by `/augmentiq dsr --type=erasure`).

**Division of labor:** the Skill generates `record_id` and `audit_ref` before the call; the server sets `recorded_at`, computes embeddings, writes the timeline entry, and maintains the hash chain.

## 4. Error codes

The server returns JSON-RPC 2.0 errors. The Skill surfaces a user-friendly message and logs the raw code to stderr.

| Code | Server meaning | Skill's user message |
|---|---|---|
| `-32700` | Parse error | "AugmentIQ+ server returned malformed response. Check the server logs." |
| `-32600` | Invalid request | "AugmentIQ+ server rejected the request. Check the Skill's payload format." |
| `-32601` | Method not found | "AugmentIQ+ server doesn't recognize this command. Possible version mismatch." |
| `-32602` | Invalid params | "AugmentIQ+ server rejected a field. The error details are: <data>." |
| `-32603` | Internal error | "AugmentIQ+ server failed. Check the container logs: `docker logs <container_id>`." |
| `-32001` | Record not found | "I couldn't find that record. Use `/augmentiq recall <query>` to search." |
| `-32002` | Permission denied | "This action is outside your role's permissions. Check `/augmentiq role list`." |
| `-32003` | Audit chain broken | "ALERT: audit chain broken. This may indicate a data integrity issue. Check `/augmentiq timeline`." |

Handling flow and troubleshooting: `references/mcp-integration.md` §4–§5.

---

**Normative for v0.1. Changes require a contract re-review (see the footer of `references/mcp-integration.md`).**