# Backend: Custom (AugmentIQ+ via MCP) — **recommended for serious/enterprise/local-first use**

> **v0.1 re-cut (2026-07-18):** the "Custom" backend is no longer the
> "user-implemented adapter" fallback. It is now **AugmentIQ+ via MCP**:
> a Docker-based, 100% local, server-owned tamper-evident audit,
> hybrid search, bi-temporal stamping. The recommended backend for
> serious/enterprise/local-first use.
>
> **The "user-implemented adapter" pattern is deprecated for v0.1.**
> It will be reintroduced in v0.2 as a separate backend option (likely
> `custom_adapter`) for users who want to plug in their own storage.
> For now, the only Custom backend is AugmentIQ+.
>
> **Install path (locked 2026-07-18):** Docker + `docker build -t augmentiq-engine` + `docker run -i augmentiq-engine`.

---

## When to use this backend

**Use AugmentIQ+ (Custom, via MCP) when:**

- **You're deploying for `organisation` or `department` tier.** The questionnaire recommends this backend by default for these tiers.
- **You need server-owned tamper-evident audit.** The AugmentIQ+ MCP server's SQLite audit table is the canonical timeline. The hash chain is enforced by the server. For compliance use cases (SOC2, GDPR, HIPAA), this is the only backend that gives you the audit guarantee out of the box.
- **You need hybrid search (BM25 + dense vectors).** AugmentIQ+ runs both and reranks internally. Other backends rely on the user's native search (which may be keyword-only, like ReMe).
- **You need bi-temporal stamping.** The `event_time` vs `recorded_time` distinction matters for legacy ingest — the original timestamp of the source is preserved.
- **You want the full AugmentIQ feature set without the per-backend limitations.** Obsidian, mem0, ReMe, and Hermes native each have quirks (file-name limits, embedding model ownership, commit cadence, char limits). AugmentIQ+ has none of these.
- **You want 100% local, no-vendor-lockin storage.** AugmentIQ+ runs in a Docker container on the user's machine. No data leaves the host. No third-party service holds the records.

**Do NOT use this backend when:**

- **You don't have Docker.** AugmentIQ+ requires Docker. If you can't install Docker, use one of the 4 secondary backends.
- **You already have a memory backend you want to keep.** If you have an Obsidian vault you want to preserve, use the Obsidian backend. If you have mem0, use the mem0 backend. AugmentIQ+ is for users who don't already have a backend.
- **You want a fully managed cloud service.** AugmentIQ+ is local-first, not cloud. For cloud, use mem0.
- **You want a single-file portable format.** AugmentIQ+ uses a Docker volume. If you want a single folder of Markdown files, use Obsidian.

---

## What this backend is

**AugmentIQ+** is the platform AugmentIQ (the Skill) talks to. It is:

- **A Docker container** (`augmentiq-engine` image) that the Skill launches as a subprocess.
- **A stdio-based MCP server** that implements 5 tools (per `references/mcp-integration.md`): `mcp_add_memory`, `mcp_search_memory`, `mcp_update_memory`, `mcp_delete_memory`, `mcp_get_audit_entry`.
- **A storage layer** with SQLite (records + timeline) + LanceDB (vectors) + internal BM25 + dense embeddings. The Skill does not see the internals.
- **A tamper-evident audit chain** that's server-owned (per the integration contract, Option A).
- **Open-source** (the AugmentIQ+ repo, license TBD; the Skill itself is MIT).

The Skill is the routing + governance layer. The server is the storage + compute layer. The contract between them is the 5 MCP tool signatures.

---

## The install path

### Step 1: Install Docker

If you don't have Docker:
- **macOS**: install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- **Linux**: install [Docker Engine](https://docs.docker.com/engine/install/).
- **Windows**: install Docker Desktop (the Skill runs in WSL2).

Verify with `docker --version`.

### Step 2: Build the AugmentIQ+ image

Clone the AugmentIQ+ repo and build:

```bash
git clone https://github.com/upsurge911-lgtm/augmentiq-plus.git
cd augmentiq-plus
docker build -t augmentiq-engine .
```

Verify with `docker images | grep augmentiq-engine`. You should see:
```
augmentiq-engine   latest   <sha256>   <date>   <size>
```

### Step 3: Install the Skill

The Skill is installed via your host agent's standard mechanism. For Hermes:

```bash
# The Skill is at the path the user cloned it to (e.g., `~/projects/AugmentIQ/`)
# Symlink or copy to ~/.hermes/skills/augmentiq/
ln -s /path/to/AugmentIQ ~/.hermes/skills/augmentiq

# Reload Hermes's skill index
hermes skills reload
```

Verify with `hermes skills list | grep augmentiq`.

### Step 4: Initialize

```bash
/augmentiq init
```

The Skill will:
1. Ask the 22 questions (for `organisation` tier; fewer for smaller tiers).
2. Detect the Custom backend (because you'll pick it in the questionnaire).
3. Launch the MCP server via `~/.hermes/skills/augmentiq/assets/mcp-launch/hermes.sh`.
4. The launch script runs `docker run -i augmentiq-engine`.
5. The Skill verifies the server is responsive (10s timeout).
6. If successful: "AugmentIQ+ connected. Audit chain initialized at <server-generated genesis hash>."

### Step 5: Verify

```bash
/augmentiq save "test record" --tags=test,first
/augmentiq recall "test"
/augmentiq timeline
/augmentiq audit --verify-chain
```

You should see the record, the timeline entry, and a clean audit chain.

---

## The MCP tools (the contract)

The Skill calls 5 tools on this backend. The full spec is in `references/mcp-integration.md`. The summary:

| Tool | When | What |
|------|------|------|
| `mcp_add_memory` | `save`, `snapshot`, `ingest` writes | Write a new record (Skill formats the AugmentIQ Context Record, server stores + writes timeline entry + computes hash chain) |
| `mcp_search_memory` | `recall`, `who-knows`, `timeline`, `audit` queries | Hybrid search; returns ranked records |
| `mcp_update_memory` | `tag`, `redact`, `retention --enforce` | Update an existing record |
| `mcp_delete_memory` | `destroy --wipe-data`, `dsr --type=erasure` | Delete or redact a record |
| `mcp_get_audit_entry` | `audit --verify-chain`, per-record verification | Read the audit hash chain |

The server returns JSON-RPC 2.0 errors. The Skill surfaces user-friendly messages. The error codes are in `references/record-schema.md` §4.

---

## The audit chain (the killer feature)

**For the AugmentIQ+ backend, the audit is server-owned and tamper-evident.** The Skill does not maintain a local `timeline.jsonl`. The server's SQLite table is the timeline.

The chain works like this:
- `entry_0.previous_hash = "genesis"`.
- For each subsequent entry: `entry_n.audit_hash = sha256(entry_n.id || entry_n.timestamp || entry_n.action || entry_n.actor || entry_n.target || entry_n.before_state || entry_n.after_state || entry_n.details || entry_n.previous_hash)`.
- `entry_n.previous_hash = entry_{n-1}.audit_hash`.

The Skill verifies the chain by:
1. Querying all entries via `mcp_search_memory` with `filters.action: "*"`.
2. For each entry, calling `mcp_get_audit_entry(record_id)` to get `{audit_hash, previous_hash, timestamp, action}`.
3. Recomputing `audit_hash` and comparing to the stored value.
4. Verifying each `previous_hash` matches the previous entry's `audit_hash`.

Any mismatch means the chain was tampered with. The Skill alerts the user.

**This is the only backend that gives you this guarantee out of the box.** The other 4 backends have timelines too (Obsidian JSONL sidecar, mem0 history API, ReMe Git log, Hermes daily log) but the hash chain is enforced by the server here, not by the user's tooling.

---

## The data model

The server stores records per the AugmentIQ Context Record schema (see `references/record-schema.md`). The Skill sends the record in this format; the server stores it. The server computes the embedding internally (the Skill never generates embeddings).

**Bi-temporal stamping:** every record has:
- `timestamp` (event_time) — when the event actually happened (e.g., when the email was sent). Set by the Skill.
- `recorded_at` (recorded_time) — when the record was written to the server. Set by the server.

For legacy ingest, the two diverge: the email's `timestamp` is 2024-03-15, the `recorded_at` is 2026-07-18. This is critical for compliance and for preserving the original chronology.

---

## The performance profile

- **Write latency**: 50-200ms per record (server computes embedding, writes to SQLite, updates LanceDB, writes timeline entry).
- **Read latency**: 20-100ms per search (server runs hybrid search, reranks, returns).
- **Audit verification**: 5-30s for 10,000 entries (one round trip per entry). For >100,000 entries, the Skill uses a batched verification (planned v0.1.1).
- **Storage**: ~2KB per record (SQLite row + LanceDB vector). 1M records ≈ 2GB.
- **Concurrent users**: 1 (single-tenant in v0.1). Multi-tenant planned v0.2.

---

## The boundaries

**The Skill does NOT do:**
- Manage Docker. The user must have Docker installed.
- Build the `augmentiq-engine` image. The user (or the AugmentIQ+ team's CI) does it.
- Back up the server's data. The user backs up the Docker volume.
- Scale the server. For >1M records, the user runs multiple containers behind a load balancer (planned v0.2).
- Modify the server's internals. The Skill only sees the 5 MCP tools.

**The server does NOT do:**
- See the 5 Immutable Principles. The server enforces the hash chain; the Skill enforces the principles.
- See the 26 commands. The Skill translates commands to MCP tool calls.
- Make the user confirm destructive actions. The Skill does that.
- Generate legal claims (GDPR compliance, SOC2 attestation). The Skill + the compliance packs do that.

---

## When this backend is the wrong choice

- **You don't have Docker.** Use Obsidian, mem0, ReMe, or Hermes native.
- **You have an existing memory backend you want to keep.** Use the per-backend reference for that backend.
- **You want a single-folder portable format.** Use Obsidian.
- **You want zero setup.** Use Hermes native (if you're on Hermes).
- **You need cloud sync.** Use mem0.

---

## See also

- `references/mcp-integration.md` — the full Skill ↔ MCP wiring (5 tools, launch, error handling, troubleshooting)
- `references/record-schema.md` — the canonical types (Record + Timeline + 5 tool signatures)
- `INSTALL_TEST.md` PATH 2 — the end-to-end integration test for this backend
- `references/commands.md` — the 26 commands and which MCP tools they invoke
- `references/mcp-integration.md` — the full Skill ↔ MCP wiring (5 tools, launch, error handling, troubleshooting)

---

**v0.1, locked 2026-07-18. Re-review at v0.1.1 or when the AugmentIQ+ team ships a new version of the `augmentiq-engine` image, whichever comes first.**
