---
type: install-test
status: ACTIVE — v0.1 install + functional test
created: 2026-07-18
author: AugmentIQ team
supersedes: the v0.0.1-alpha plan
tags: [augmentiq, install-test, e2e, hermes, openclaw, custom, v0.1]
---

# Install Test Plan — AugmentIQ v0.1

> **This is the v0.1 install + functional test plan.** It supersedes
> the v0.0.1-alpha plan (in the build folder, archived).
> The v0.0.1-alpha plan covered the 4 secondary backends. The v0.1
> plan adds the full Custom (AugmentIQ+ via MCP) integration test, now
> that the install path and audit chain ownership are locked
> (locked 2026-07-18).
>
> **The 3 test paths:**
> 1. **Skill-only** — run `/augmentiq help` through `/augmentiq destroy`
>    against a mocked MCP server. No Docker, no AugmentIQ+ container.
>    Used during Skill development, before the AugmentIQ+ team ships the server.
> 2. **Custom (AugmentIQ+ via MCP)** — full integration. Docker
>    required, the `augmentiq-engine` image built. Used when
>    the AugmentIQ+ container is ready.
> 3. **Secondary backends** — Obsidian, mem0, ReMe, Hermes native.
>    Per-backend, run only the parts that exercise the backend.

## 0. Pre-flight checks (do these before any test path)

```bash
# 1. Install directory
ls -la ~/.hermes/skills/augmentiq/
# Expect: SKILL.md, references/, assets/, LICENSE, README.md, INSTALL_TEST.md

# 2. SKILL.md frontmatter
head -10 ~/.hermes/skills/augmentiq/SKILL.md
# Expect: --- / name: augmentiq / description: ... (description mentions AugmentIQ+ for Custom) / ---

# 3. References tree (should include mcp-integration.md)
ls ~/.hermes/skills/augmentiq/references/
# Expect: PRINCIPLES.md, commands.md, crons.md, dreaming-systems.md, flows.md,
#         mcp-integration.md, pii-patterns.md, questionnaire.md, record-schema.md,
#         routing.md, strategies.md, variables.md, batch_protocol.md, estimator.md,
#         ingest/, agents/, backends/

# 4. MCP launch scripts
ls ~/.hermes/skills/augmentiq/assets/mcp-launch/
# Expect: hermes.sh, openclaw.sh, claude_code.sh, codex.sh, cursor.sh
# Each is chmod +x and contains `docker run -i augmentiq-engine`

# 5. Questionnaires are real
for f in individual team department organisation; do
  size=$(stat -f%z ~/.hermes/skills/augmentiq/assets/questionnaires/$f.json)
  echo "$f.json: $size bytes"
done
# Expect: individual ~3.3KB, team ~5.1KB, department ~7.6KB, organisation ~9.3KB

# 6. Hermes indexed the skill
hermes skills list | grep augmentiq
# Expect: status 'enabled', scope 'local'
```

**If any check fails, do not proceed.** The failure is in the install, not the Skill.

---

## PATH 1: Skill-only test (no MCP server)

Use this when:
- The Skill is being developed (frequent iteration)
- The AugmentIQ+ container is not yet available
- You're testing the Skill's logic in isolation

**The mock:** the Skill is launched with `AUGMENTIQ_MOCK_MCP=1` in the environment. When this is set, the Skill's MCP client returns canned responses (a local JSONL of mocked record ids, a local search index of mocked results). The Skill's logic runs as if it were talking to a real MCP server; the storage side is faked.

### 1.1 `/augmentiq help` — the dispatch test

**Command:** `/augmentiq help`

**Expected:** the 26 commands grouped (onboarding 4, capture 3, query 3, compliance 5, migration 3, legacy ingest 8, meta 1). The 5 Immutable Principles are referenced. The output mentions the 5 backends, with AugmentIQ+ (Custom) as the recommended for serious use.

**Pass criteria:** all 26 commands listed, no error, the 5 backends shown with AugmentIQ+ as the recommended.

### 1.2 `/augmentiq status` (pre-init)

**Command:** `/augmentiq status`

**Expected:** "AugmentIQ is not initialised. Run /augmentiq init to configure." No auto-trigger of init. (Per Principle 4: per-action confirmation.)

### 1.3 `/augmentiq init` (with mock)

**Command:** `/augmentiq init`

**With `AUGMENTIQ_MOCK_MCP=1`, pick the test path:** choose `organisation` tier, `custom` (AugmentIQ+ via MCP) as the backend. Walk the 22 questions. **The Skill should:**
- Detect the mock and inform the user ("Running in mock mode — records will not persist; use this for testing only")
- NOT launch Docker (the mock bypasses the launch)
- Still ask the 22 questions (the questionnaire is backend-agnostic)
- Show the per-action confirmation before writing `~/.augmentiq/config.yaml`

**Pass criteria:** 22 questions asked in order, smart defaults pre-filled, confirmation shown, config written, mock-mode warning surfaced.

### 1.4 `/augmentiq status` (post-init)

**Expected:** the status block reflects the `organisation` tier + `custom` backend. The MCP server is reported as "mocked" (because `AUGMENTIQ_MOCK_MCP=1`).

### 1.5 `/augmentiq save "test record"`

**Expected:** confirmation prompt with record preview (classification: `internal` by default for organisation tier, tags: `[]`, source: `manual`). After confirm: mock returns a fake `augmentiq:<uuid>` id. The Skill's mock mode logs the action to `~/.augmentiq/timeline.jsonl.mock` (not the real timeline; the real timeline lives on the MCP server).

### 1.6 `/augmentiq recall "test"`

**Expected:** mock returns the record from step 1.5. The Skill formats and returns the match.

### 1.7 `/augmentiq timeline --filter=save,init`

**Expected:** 2+ entries (init + save), each with timestamp, action, actor (`user:<user_id>`), `user_confirmed: true`. The mock writes to `~/.augmentiq/timeline.jsonl.mock`.

### 1.8 `/augmentiq audit --verify-chain`

**Expected:** the Skill calls the (mocked) `mcp_get_audit_entry` for each entry, verifies the chain. Mock returns clean chain. Skill reports "Chain verified: N entries, no breaks."

### 1.9 `/augmentiq destroy --keep-config`

**Expected:** two confirmations (typed `destroy` then `destroy-permanently`). The Skill writes a destruction log to `~/.augmentiq/destroyed/<timestamp>.log`. The config is preserved.

---

## PATH 2: Custom (AugmentIQ+ via MCP) — full integration

Use this when:
- the AugmentIQ+ team has shipped the `augmentiq-engine` Docker image
- You're verifying the full Skill ↔ MCP server wiring
- You're running the install test as part of the v0.1 release gate

**Prerequisites:**
- Docker installed (`docker --version` works)
- The `augmentiq-engine` image built (`docker images | grep augmentiq-engine`)
- The Skill's per-host launch script is on the PATH (e.g., `~/.hermes/skills/augmentiq/assets/mcp-launch/hermes.sh`)

### 2.1 Pre-flight (MCP-specific)

```bash
# Docker is available
docker --version
# Expect: Docker version 20.x or later

# The image exists
docker images augmentiq-engine
# Expect: augmentiq-engine   latest   <sha256>   <date>   <size>

# The launch script is executable
ls -la ~/.hermes/skills/augmentiq/assets/mcp-launch/hermes.sh
# Expect: -rwxr-xr-x

# The Skill can invoke the script
~/.hermes/skills/augmentiq/assets/mcp-launch/hermes.sh --check
# Expect: "AugmentIQ+ launch script OK. Image: augmentiq-engine:latest. Will run: docker run -i augmentiq-engine"
```

### 2.2 `/augmentiq init` with Custom backend

**Command:** `/augmentiq init`

**Pick:** `organisation` tier, `custom` (AugmentIQ+ via MCP) as the backend. Walk the 22 questions.

**Expected behavior:**
- After the user confirms the config, the Skill writes `~/.augmentiq/config.yaml`.
- The Skill then launches the MCP server via `assets/mcp-launch/hermes.sh`.
- The launch script runs `docker run -i augmentiq-engine`. The container's stdio becomes the MCP channel.
- The Skill verifies the server is responsive by calling `mcp_search_memory` with a `limit: 0` ping (a lightweight handshake).
- If the server doesn't respond within 10 seconds, the Skill aborts init and tells the user to check the Docker image.

**Pass criteria:** the MCP server is reachable, the handshake succeeds, the Skill reports "AugmentIQ+ connected. Audit chain initialized at <server-generated genesis hash>."

### 2.3 `/augmentiq save "test record"`

**Command:** `/augmentiq save "test record from v0.1 install test"`

**Expected behavior:**
- Skill shows confirmation prompt (classification: `internal` for org tier, PII patterns: `[]` for the test content, tags: `[]`).
- User confirms.
- Skill calls `mcp_add_memory` with the AugmentIQ Context Record (Schema A), the `audit_hash` cross-reference, and the `request_id`.
- The server stores the record and writes the timeline entry. The server returns `{record_id, status: "ok", recorded_at: <server-set ISO 8601>}`.
- Skill logs the action to the user's view: "Saved: augmentiq:<uuid>. Recorded at <server-set timestamp>."

**Pass criteria:** the server returns a record id, the Skill displays it, the action appears in `/augmentiq timeline`.

### 2.4 `/augmentiq recall "test record"`

**Command:** `/augmentiq recall "test record"`

**Expected behavior:**
- Skill calls `mcp_search_memory` with the query, scope (`organisation`), filters (no filters for the test), limit (10).
- Server returns ranked records. For the single test record, the response is 1 match.
- Skill formats and displays the record (id, content snippet, classification, tags, recorded_at).

**Pass criteria:** 1 match returned, the match is the record from step 2.3.

### 2.5 `/augmentiq audit --verify-chain` — the integration-critical test

**Command:** `/augmentiq audit --verify-chain`

**Expected behavior:**
- Skill queries the timeline: `mcp_search_memory` with `filters.action = "*"`, large `limit`.
- For each entry, Skill calls `mcp_get_audit_entry(record_id)` to get the entry's `{audit_hash, previous_hash, timestamp, action}`.
- Skill recomputes `audit_hash` for each entry (using the formula in `references/record-schema.md` §2.4) and compares.
- Skill verifies each `previous_hash` matches the previous entry's `audit_hash`.
- Skill reports the result: "Chain verified: N entries, no breaks" or "Chain broken at entry <id>: stored hash X, computed hash Y."

**Pass criteria:** chain verifies clean. This is the proof that the server-owned audit is working end-to-end.

### 2.6 `/augmentiq export --include=timeline`

**Command:** `/augmentiq export --include=timeline --format=jsonl`

**Expected behavior:**
- Skill fetches the full timeline via `mcp_search_memory`.
- Skill fetches the full record set via `mcp_search_memory` with a broad query.
- Skill writes a portable JSONL file at `~/.augmentiq/exports/<timestamp>.jsonl` containing all records + all timeline entries.
- The export follows the canonical schema (see `references/record-schema.md` §1.1 for the record shape, §2.1 for the timeline shape).

**Pass criteria:** the export file is created, contains all records + timeline entries, follows the schema.

### 2.7 `/augmentiq destroy --wipe-data` (the full teardown)

**Command:** `/augmentiq destroy --wipe-data`

**Expected behavior:**
- First confirmation prompt: "This will: disable N crons, stop N ingest sources, wipe all records from the MCP server, log the destruction."
- User types `destroy`.
- Second confirmation prompt: "This is irreversible. Type `destroy-permanently` to confirm."
- User types `destroy-permanently`.
- For each record: Skill calls `mcp_delete_memory(record_id, delete_type: "destroy", ...)`. The server removes the record and writes a timeline entry.
- The Skill writes a destruction log to `~/.augmentiq/destroyed/<timestamp>.log`.
- The Skill stops the MCP server container.
- The Skill removes the config.

**Pass criteria:** all records deleted, all timeline entries written, destruction log created, MCP server stopped, config removed.

---

## PATH 3: Secondary backends (Obsidian, mem0, ReMe, Hermes native)

For each backend, run only the parts of PATH 1 / PATH 2 that exercise the backend. The Skill's per-backend reference (`references/backends/<name>.md`) documents the per-backend specifics.

### 3.1 Obsidian

- Skip 2.2 (the MCP handshake). Instead, verify the vault path is writable.
- Run 2.3-2.6 against the Obsidian vault. Records are written as Markdown files with YAML frontmatter. The timeline is a JSONL sidecar.
- The per-backend reference documents the path layout: `<vault>/<classification>/<scope>/<source>/<safe_title>.md`.

### 3.2 mem0

- Skip 2.2. Verify the `MEM0_API_KEY` env var is set.
- Run 2.3-2.6 against the mem0 instance. Records are wrapped in mem0's user/system message format; metadata goes in mem0's `metadata` field.
- The per-backend reference documents the per-user / per-tenant config.

### 3.3 ReMe

- Skip 2.2. Verify the ReMe directory is initialized (`reme init` was run).
- Run 2.3-2.6 against the ReMe directory. Records are committed via Git. The timeline is the Git log.
- The per-backend reference documents the commit cadence.

### 3.4 Hermes native

- Skip 2.2. Verify `~/.hermes/memories/MEMORY.md` exists and has space.
- Run 2.3-2.6 against the Hermes MEMORY.md + USER.md. Records are appended to the daily log. The timeline is the daily log.
- **Caveat:** the 2200-char MEMORY.md limit + 1375-char USER.md limit apply. Records that exceed the limit are split or summarized.

---

## Pass / fail decision

The v0.1 is "release-ready" when:

- All pre-flight checks (§0) pass.
- PATH 1 (Skill-only) passes on Hermes.
- PATH 2 (Custom) passes on Hermes (requires the AugmentIQ+ container).
- At least 1 PATH 3 test passes (validates that the secondary backends are not broken by the v0.1 changes).
- No Principle violations observed: no unconfirmed writes, no silent failures, no data loss without explicit destroy, no chain breaks.

If any test fails, **do not promote to v0.1.0**. Fix the failure, re-run the failing test, re-run the full suite, then promote.

## Reporting failures

If a test fails, capture:
1. The exact command.
2. The exact error message (verbatim).
3. The Skill's stderr output (for MCP errors, check the JSON-RPC code from `references/record-schema.md` §4).
4. The state of `~/.augmentiq/` before and after (`ls -la`).
5. The relevant timeline entries (via `/augmentiq timeline --filter=<action>`).
6. The Docker container logs (for PATH 2 failures): `docker logs <container_id>`.

Report to the AugmentIQ maintainers with the captured state. The Skill author reproduces, identifies root cause, ships a fix.

---

**v0.1, locked 2026-07-18. Re-validate when the AugmentIQ+ team ships the v1 of the augmentiq-engine image, or at v0.1.1, whichever comes first.**
