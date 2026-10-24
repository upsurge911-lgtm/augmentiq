---
type: reference
status: ACTIVE — Skill ↔ MCP server wiring
created: 2026-07-18
author: AugmentIQ team
applies_to: when the configured backend is `custom` (AugmentIQ+ via MCP)
tags: [augmentiq, mcp, integration, mcp-integration, v0.1]
---

# MCP Integration — Skill ↔ AugmentIQ+ Server

> **What this is.** The canonical wiring between the AugmentIQ v0.1
> Skill and the AugmentIQ+ MCP server. The 5 tools, the launch
> procedure, the handshake, the error handling, the per-host launch
> scripts, the troubleshooting.
>
> **What this is not.** Not a spec for the AugmentIQ+ server's
> internals. Not the per-backend reference (that's in
> `references/backends/custom.md`). Not the install test (that's in
> `INSTALL_TEST.md`).
>
> **The contract is the boundary.** The AugmentIQ+ team owns and
> ships the server. The AugmentIQ team owns and ships the Skill.
> This doc is the surface they meet at.

## 0. The architecture in 1 minute

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Host Agent    │         │  AugmentIQ v0.1 │         │  AugmentIQ+     │
│  (Hermes,       │◀───────▶│     Skill       │◀───────▶│  MCP Server     │
│   OpenClaw,     │         │                 │ stdio   │  (Docker)       │
│   Claude Code,  │         │  Formats Record │ via     │                 │
│   Codex, Cursor)│         │  Enforces 5 P's │ docker  │  Stores records │
│                 │         │  Hands over     │         │  Computes hash  │
└─────────────────┘         └─────────────────┘         │  Runs search    │
                                                        └─────────────────┘
```

- **The Skill** formats the AugmentIQ Context Record, calls the 5 MCP tools, enforces the 5 Principles.
- **The server** stores the records in SQLite, computes the audit hash chain, runs hybrid search (BM25 + dense vectors), handles bi-temporal stamping.
- **The host agent** runs the Skill, displays results, takes user input.
- **The transport** is stdio via the per-host launch script (`assets/mcp-launch/<host>.sh` → `docker run -i augmentiq-engine`).

## 1. The 5 MCP tools (the contract)

Per the integration contract locked 2026-07-18T18:45, the server implements these 5 tools. The Skill uses these exact shapes.

### 1.1 `mcp_add_memory`

**When:** every `save`, `snapshot`, `ingest` write.

**Input (the Skill sends):**
```json
{
  "tool": "mcp_add_memory",
  "arguments": {
    "record": {
      "schema_version": "1.0",
      "id": "augmentiq:<uuid-v4>",
      "timestamp": "<ISO 8601, event time>",
      "scope": "<individual|team|department|organisation>",
      "source": "<source_type>:<source_id>:<source_internal_id>",
      "content": "<the actual content>",
      "tags": ["..."],
      "classification": "<public|internal|confidential|restricted>",
      "retention_policy": {"days": 2555, "until": "...", "action_on_expiry": "archive|delete"},
      "audit_ref": "augmentiq-tl:<uuid-v4>",
      "provenance": {"source_system": "...", "<source-specific>": "..."},
      "pii_patterns": ["..."],
      "embedding": null,
      "embedding_ref": null
    },
    "audit_hash": "<sha256 of the timeline entry that caused this write>",
    "request_id": "augmentiq:<uuid-v4>"
  }
}
```

**Output (server returns):**
```json
{
  "record_id": "augmentiq:<uuid-v4>",
  "status": "ok",
  "recorded_at": "<ISO 8601, server-set>"
}
```

The Skill **generates the `record_id` (with `augmentiq:` prefix)** before calling. The server **sets `recorded_at`** and returns it. The server stores the record + writes a timeline entry + computes the audit hash chain.

### 1.2 `mcp_search_memory`

**When:** every `recall`, `who-knows`, `timeline`, `audit` query.

**Input:**
```json
{
  "tool": "mcp_search_memory",
  "arguments": {
    "query": "<the search query>",
    "scope": "<individual|team|department|organisation>",
    "filters": {
      "classification": ["<public|internal|confidential|restricted>"],
      "tags": ["<tag>"],
      "timestamp_range": {"start": "<ISO 8601>", "end": "<ISO 8601>"},
      "source": ["<source_id>"],
      "action": "<timeline action name, for timeline queries>"
    },
    "limit": 10,
    "request_id": "augmentiq:<uuid-v4>"
  }
}
```

**Output:**
```json
{
  "records": [/* array of AugmentIQ Context Records */],
  "total": 42,
  "request_id": "augmentiq:<uuid-v4>"
}
```

**For empty queries** (e.g., timeline listing): use `query: ""` with a filter. The server returns matching records. The Skill uses `mcp_search_memory` for both records AND timeline entries — the timeline entries are stored as records with `action` in the filter.

### 1.3 `mcp_update_memory`

**When:** every `tag`, `redact`, `retention --enforce` write.

**Input:**
```json
{
  "tool": "mcp_update_memory",
  "arguments": {
    "record_id": "augmentiq:<uuid-v4>",
    "updates": {
      "tags": ["<new tags>"],
      "classification": "<new classification>",
      "redacted": true,
      "retention_until": "<ISO 8601>"
    },
    "audit_hash": "<sha256 of the timeline entry>",
    "request_id": "augmentiq:<uuid-v4>"
  }
}
```

**Output:**
```json
{ "status": "ok", "updated_at": "<ISO 8601, server-set>" }
```

The server updates the record + writes a timeline entry. The hash chain is updated.

### 1.4 `mcp_delete_memory`

**When:** every `destroy --wipe-data`, `dsr --type=erasure`.

**Input:**
```json
{
  "tool": "mcp_delete_memory",
  "arguments": {
    "record_id": "augmentiq:<uuid-v4>",
    "delete_type": "redact|destroy|erasure",
    "audit_hash": "<sha256 of the timeline entry>",
    "request_id": "augmentiq:<uuid-v4>"
  }
}
```

**Output:**
```json
{ "status": "ok", "deleted_at": "<ISO 8601, server-set>" }
```

**Delete types:**
- `redact` — content is replaced with `[REDACTED — <reason> on <timestamp>]`. The audit hash is preserved. The timeline entry is written.
- `destroy` — content is removed entirely. The audit hash is preserved. The timeline entry is written.
- `erasure` — same as `destroy` but tagged with the GDPR Art. 17 reason. Used by `/augmentiq dsr --type=erasure`.

### 1.5 `mcp_get_audit_entry` (Option A — the 5th tool)

**When:** every `audit --verify-chain` or per-record audit verification.

**Input:**
```json
{
  "tool": "mcp_get_audit_entry",
  "arguments": {
    "record_id": "augmentiq:<uuid-v4>",
    "request_id": "augmentiq-tl:<uuid-v4>"
  }
}
```

**Output:**
```json
{
  "audit_hash": "<sha256>",
  "previous_hash": "<sha256 | 'genesis'>",
  "timestamp": "<ISO 8601>",
  "action": "<action name>",
  "actor": "<actor>",
  "record_id": "augmentiq:<uuid-v4>",
  "request_id": "augmentiq-tl:<uuid-v4>"
}
```

The Skill uses this to verify the chain. For full verification: query all entries via `mcp_search_memory` with `filters.action: "*"`, then call `mcp_get_audit_entry` for each, recompute the hash, verify `previous_hash` matches the previous entry's `audit_hash`.

## 2. The launch sequence

### 2.1 Pre-launch (the Skill checks)

Before invoking the launch script, the Skill:
1. Reads `~/.augmentiq/config.yaml` to confirm `memory_backend: custom`.
2. Checks for the launch script: `assets/mcp-launch/<host>.sh` (where `<host>` is the detected host).
3. Checks Docker is available: `docker --version` returns successfully.
4. Checks the image exists: `docker images | grep augmentiq-engine` returns a line.

If any of these fail, the Skill surfaces a user-friendly error and does NOT attempt to launch.

### 2.2 Launch (the Skill invokes)

The Skill runs:
```bash
~/.hermes/skills/augmentiq/assets/mcp-launch/<host>.sh
```

The script:
1. Sets up the host-specific environment (PATH, env vars, etc.).
2. Invokes `docker run -i augmentiq-engine`. The `-i` flag keeps stdin open for stdio.
3. The container's stdio becomes the MCP channel. The Skill's process holds the subprocess and pipes JSON-RPC to/from it.

### 2.3 Handshake (the Skill verifies)

Immediately after launch, the Skill sends a lightweight `mcp_search_memory` with `limit: 0` to confirm the server is responsive. The server returns an empty result.

**If no response within 10 seconds**, the Skill:
1. Kills the subprocess.
2. Surfaces: "MCP server did not respond within 10s. Check: (1) Docker is running, (2) the augmentiq-engine image is built, (3) no port conflict."
3. Does NOT proceed with the user's command.

### 2.4 Per-command flow

For every `/augmentiq <command>` invocation:
1. The Skill parses the command.
2. The Skill checks if the MCP subprocess is alive. If not, run §2.2 again.
3. The Skill formats the appropriate MCP tool call.
4. The Skill sends the JSON-RPC request over stdio.
5. The Skill waits for the response.
6. The Skill parses the response and returns the result to the user.
7. The Skill logs the action to the user's chat (the timeline entry is written by the server).

### 2.5 Teardown (the Skill cleans up)

When the host agent's session ends (or the Skill is destroyed):
1. The Skill sends a `shutdown` JSON-RPC notification (if the server supports it; otherwise, just kills the subprocess).
2. The Skill kills the subprocess (`docker stop`).
3. The Skill removes the subprocess PID from the lock file (so the next launch can succeed).

The Skill does NOT need to explicitly clean up; the host agent's session cleanup will reap the subprocess.

## 3. The 5 per-host launch scripts

All 5 scripts are in `assets/mcp-launch/`. Each is `chmod +x` and contains the per-host environment setup. The actual MCP launch is the same across hosts: `docker run -i augmentiq-engine`.

### 3.1 `hermes.sh` (primary)

```bash
#!/usr/bin/env bash
# AugmentIQ+ MCP server launcher for Hermes
# Usage: hermes.sh [--check]
set -euo pipefail

IMAGE_NAME="augmentiq-engine"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--check" ]]; then
  echo "AugmentIQ+ launch script OK. Image: ${IMAGE_NAME}:latest. Will run: docker run -i ${IMAGE_NAME}"
  exit 0
fi

# Verify Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker not found on PATH. Install Docker to use the Custom backend." >&2
  exit 1
fi

# Verify the image exists
if ! docker images --format "{{.Repository}}" | grep -q "^${IMAGE_NAME}$"; then
  echo "Error: Docker image '${IMAGE_NAME}' not found. Build with: docker build -t ${IMAGE_NAME} /path/to/augmentiq-plus" >&2
  exit 1
fi

# Launch the container with stdio
exec docker run -i --rm "${IMAGE_NAME}"
```

### 3.2 `openclaw.sh` (secondary)

Same as `hermes.sh` but with OpenClaw-specific environment variables. The MCP launch is identical.

### 3.3 `claude_code.sh` (Tier 2)

Claude Code does not auto-launch MCP servers via Skills. The launch script must be invoked manually before running AugmentIQ commands. The script is the same as `hermes.sh`; the user runs it in a separate terminal.

### 3.4 `codex.sh` (Tier 2)

Same as Claude Code — manual launch required. The script is the same.

### 3.5 `cursor.sh` (Tier 3)

Same as Claude Code — manual launch required. The script is the same.

## 4. Error handling

The server returns JSON-RPC 2.0 errors per `references/record-schema.md` §4. The Skill maps these to user-friendly messages.

| Code | Server meaning | Skill's user message |
|------|----------------|---------------------|
| -32700 | Parse error | "AugmentIQ+ server returned malformed response. Check the server logs." |
| -32600 | Invalid request | "AugmentIQ+ server rejected the request. Check the Skill's payload format." |
| -32601 | Method not found | "AugmentIQ+ server doesn't recognize this command. Possible version mismatch." |
| -32602 | Invalid params | "AugmentIQ+ server rejected a field. The error details are: <data>." |
| -32603 | Internal error | "AugmentIQ+ server failed. Check the container logs: `docker logs <container_id>`." |
| -32001 | Record not found | "I couldn't find that record. Use `/augmentiq recall <query>` to search." |
| -32002 | Permission denied | "This action is outside your role's permissions. Check `/augmentiq role list`." |
| -32003 | Audit chain broken | "ALERT: audit chain broken. This may indicate a data integrity issue. Check `/augmentiq timeline`." |

The raw error code is logged to the Skill's stderr for debugging. The user sees only the friendly message.

## 5. Troubleshooting

### Symptom: "Docker not found on PATH"

**Cause:** Docker is not installed or not on the user's PATH.
**Fix:** install Docker Desktop (macOS/Windows) or Docker Engine (Linux). Verify with `docker --version`.

### Symptom: "Docker image 'augmentiq-engine' not found"

**Cause:** the AugmentIQ+ container has not been built.
**Fix:** clone the AugmentIQ+ repo and build: `docker build -t augmentiq-engine .` in the augmentiq-plus directory.

### Symptom: "MCP server did not respond within 10s"

**Cause:** container failed to start, or there's a port conflict, or Docker is paused.
**Fix:** check `docker ps -a` to see if the container is running. Check the container logs: `docker logs <container_id>`. Verify Docker is not paused.

### Symptom: "Record not found" on a save

**Cause:** the Skill generated the `record_id` but the server didn't store it. Possible race condition.
**Fix:** the Skill retries once with the same `record_id`. If still failing, the Skill surfaces the error to the user.

### Symptom: "Audit chain broken" on verification

**Cause:** the server's hash chain has been tampered with, OR the Skill is querying out of order, OR a previous write was interrupted.
**Fix:** the Skill surfaces the alert. The user runs `/augmentiq audit --verify-chain --repair` (planned v0.1.1) which re-syncs the local mirror from the server. The user MUST investigate the cause before the repair.

## 6. The launch script contract

All 5 per-host scripts follow the same contract:
- `--check` flag: print a status line and exit 0 if everything is OK.
- No flags: launch the subprocess. The Skill holds the subprocess and communicates over its stdio.
- Errors are written to stderr with a non-zero exit code.
- Success: the container runs indefinitely (until the Skill kills it or the host session ends).

The scripts do NOT background the container. The Skill holds the foreground process; the container's lifecycle is tied to the Skill's process.

## 7. The Mock mode (for testing without Docker)

For development and for PATH 1 of the install test, the Skill supports a mock mode:
- Set `AUGMENTIQ_MOCK_MCP=1` in the environment.
- The Skill uses canned responses instead of launching the MCP server.
- Records are written to a local `~/.augmentiq/timeline.jsonl.mock` (NOT the server's audit).
- The Skill logs a clear warning: "Running in mock mode — records will not persist."

The mock mode bypasses the launch scripts entirely. The Skill's logic runs as if it were talking to a real server; the storage side is faked.

## 8. The Skill does NOT do

- The Skill does NOT start or manage Docker. It just runs `docker run -i augmentiq-engine`. The user must have Docker installed.
- The Skill does NOT build the `augmentiq-engine` image. The user (or the AugmentIQ+ team's CI) builds it.
- The Skill does NOT modify the container's data. The server stores in a Docker volume; the Skill has no visibility into the volume layout.
- The Skill does NOT back up the server's data. Backups are the user's responsibility (or the consultant's, per the migration engagement).
- The Skill does NOT scale the server. For >1M records, the user runs multiple containers behind a load balancer (planned v0.2).

---

**v0.1, locked 2026-07-18. Re-review when the AugmentIQ+ team ships a new version of the `augmentiq-engine` image, or at v0.1.1, whichever comes first.**
