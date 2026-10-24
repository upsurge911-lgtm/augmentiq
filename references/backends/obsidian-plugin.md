# Backend: Obsidian plugin (AugmentiQ embedded) — the consumer product

> **What this is.** The AugmentiQ Obsidian plugin with its **embedded MCP server** — the consumer product: one plugin install, zero external services, zero Docker. The Skill governs it like any backend; the plugin owns storage, search, and the tamper-evident audit chain inside the vault.
>
> **Status:** v0.1 — built, deployed, and dogfooding. Live in the Robin's Brain vault since 2026-10-24 (22/22 smoke checks passing, audit chain verified).

## When to use this backend

**Use the Obsidian plugin when:**

- **You want the consumer experience.** Install one Obsidian plugin → copy the token → done. No Docker, no container, no launch scripts.
- **Your memory lives in your vault.** Records are stored in `.augmentiq/` (memories.jsonl + audit.log) inside the vault — visible, local, yours.
- **You run Obsidian anyway** (individual or small-team tier).

**Do NOT use this backend when:**

- You need **multi-user org memory with server-side RBAC** — use AugmentIQ+ (Docker) instead.
- You don't use Obsidian. Then AugmentIQ+ or a secondary backend fits better.

## How it differs from AugmentIQ+ (Docker)

| | AugmentIQ+ (Docker) | Obsidian plugin |
|---|---|---|
| Transport | stdio via launch scripts (`assets/mcp-launch/<host>.sh`) | **HTTP** at `http://127.0.0.1:3710/mcp` |
| Lifecycle | launched by the Skill (`docker run -i augmentiq-engine`) | **auto-starts with Obsidian** — no launch step, no scripts |
| Storage | Docker volume (SQLite) | vault-local `.augmentiq/` (JSONL + hash-chained audit log) |
| Auth | container-local stdio (implicit trust) | **Bearer token** (auto-generated, copy from plugin settings/ribbon) |
| Docker required | yes | **no** |
| Read-only mode | n/a | yes (settings toggle, enforced server-side) |
| Contract compliance | full 5-tool contract | full 5-tool contract (same schemas, same error codes) |

Both implement the same 5 contract tools per `references/record-schema.md` and `references/mcp-integration.md` §1 — the Skill's flows do not change between them.

## Connection (what the Skill does)

1. **Prerequisite:** the AugmentiQ Obsidian plugin is installed and enabled in the user's vault. Server binds `127.0.0.1:3710` (port configurable).
2. **Token:** from the plugin settings (or the ribbon icon copies it). Constant-time compared server-side.
3. **Wire the client.** With mcporter, register once in `~/.mcporter/mcporter.json` (the proven pattern):

```json
{
  "mcpServers": {
    "augmentiq": {
      "baseUrl": "http://127.0.0.1:3710/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Then call any tool: `mcporter call augmentiq.mcp_add_memory --args '{...}'`

> Note: mcporter's ad-hoc URL call mode (`mcporter call http://localhost:3710/mcp.tool --auth ...`) hangs against HTTP servers — always use the configured-server path above. Direct HTTP (curl or any MCP streamable-HTTP client) also works: the server is stateless and answers `initialize` / `tools/list` / `tools/call` per request.

4. **Handshake:** stateless streamable HTTP. A `tools/call` works without a prior `initialize` in the same connection. `GET /health` (no auth) returns liveness: `{"status":"ok","server":"augmentiq","vault":"<name>"}`.

## Tool surface

The plugin exposes **10 tools** — the 5 contract tools (for the Skill's flows) plus 5 consumer tools (for the memory-loop experience):

**Contract (governance — the Skill drives these):**
- `mcp_add_memory`, `mcp_search_memory`, `mcp_update_memory`, `mcp_delete_memory`, `mcp_get_audit_entry` — same shapes, same JSON-RPC error codes (-32001/-32002/-32003) as `references/record-schema.md` §3–§4.

**Consumer (the memory loop — recall → reason → respond → record):**
- `memory` — recall (lexical + tag/importance/recency scoring), remember (typed: observation/conclusion/preference/instruction/summary), forget (archive, confirm required), health (stats + **chain verification**), profile (reads `profile.md` at vault root), consolidate (non-destructive duplicate/stale analysis)
- `vault` — list/read/create/update/delete(search via scan, delete → system trash)/move/rename/copy
- `edit` — append, window (exact + fuzzy replace), patch (heading / frontmatter)
- `graph` — forwardlinks/backlinks/neighbors/traverse/path via the vault's link index
- `system` — server info, plugin commands

## Verification (Principle 5)

- Every mutation appends a SHA-256 hash-chained entry to `.augmentiq/audit.log` (server-owned timeline — the plugin IS the server).
- `memory` `action: health` returns `chain: {ok, checked}` — forward recomputation verified at dogfood scale.
- `mcp_get_audit_entry` reads back any record's latest audit entry.

## Config (per `references/variables.md`, backend id: `obsidian_plugin`)

- `memory_backend: obsidian_plugin` — HTTP transport to `127.0.0.1:3710`, no launch script, token in the client config (never in `~/.augmentiq/config.yaml` in plaintext — use the client's credential store).
- Read-only mode: plugin settings toggle; the server rejects all writes with `-32002`.

## Known limits (v0.1)

- `vault.search` scans the first 400 markdown files per call (line matches, capped at 50 results) — full index integration is v1.1 work.
- Lexical scoring first (per D5); local embeddings arrive behind a flag in v1.1.
- `edit.patch` supports heading and frontmatter targets; block patches use `window`.
- Desktop only (`isDesktopOnly: true`).
- The timeline is server-owned and plugin-local; org-tier RBAC and compliance packs remain AugmentIQ+ territory.