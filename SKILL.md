---
name: augmentiq
description: Govern a memory backend for an AI agent. Captures, classifies, retains, audits, redacts, migrates, and destroys. Works with 5 backends: AugmentIQ+ (Custom, via MCP — recommended for serious/enterprise/local-first use), Obsidian, mem0, ReMe, and Hermes native. Use when the user asks to set up, configure, capture to, recall from, retain, audit, redact, fulfill a DSR, migrate, or destroy an agent's persistent memory. NOT for ephemeral chat memory, RAG pipelines, fine-tuning datasets, prompt caches, or general observability. Triggers on /augmentiq <subcommand>.
---

# AugmentIQ

> Portable Agent Skill that helps legacy companies become AI-native
> by transferring years of historical data into a memory backend of
> their choice (AugmentIQ+ via MCP — recommended for serious/enterprise/
> local-first use, plus Obsidian, mem0, ReMe, and Hermes native) on a
> platform that supports the open Agent Skills standard. Solves the
> memory and context problem. Free, MIT, v0.1.

## 1. When to use this skill / when NOT to use it

**Use AugmentIQ when the user wants to govern an agent's memory:**
- Set up an agent's persistent memory (init, reconfigure, destroy)
- Capture a new record (snapshot, save, tag)
- Query context (recall, timeline, who-knows)
- Audit or enforce retention (audit, retention, redact, role)
- Fulfill a data subject request (dsr)
- Migrate memory between backends (migrate, export, import)
- Bring historical data into the memory (ingest + 8 sub-commands)

**Do NOT use AugmentIQ for:**
- **Ephemeral chat memory** — use the agent's session log.
- **RAG pipelines** — use a vector DB + retriever, not governance.
- **Fine-tuning datasets** — different lifecycle.
- **Prompt caches** — different layer.
- **General observability** — use the agent's native log tool.
- **Single-session scratchpads** — use the agent's context window.

The 5 Immutable Principles apply on every action. Read `references/PRINCIPLES.md` once if you have not this session.

## 2. On any `/augmentiq <subcommand>` invocation

1. Parse the subcommand. Match against the 26 in `references/commands.md`.
2. Dispatch to the matching flow in `references/flows.md`.
3. Apply the 5 principles: confirmation per Principle 4, audit per Principle 5, reversibility per Principle 3.
4. If the configured backend is `custom` (AugmentIQ+ via MCP), call the appropriate MCP tool (5 tools; see `references/mcp-integration.md` and `references/record-schema.md` §3). The MCP server is the storage + compute layer; the Skill is the routing + governance layer.
5. Write one timeline entry per state change. The timeline is **server-owned** (for the Custom backend; per the integration contract locked 2026-07-18). The server computes the hash chain; the Skill calls `mcp_get_audit_entry` for verification.

**Negative case:** if the user said "remember this" without a slash command, do not auto-trigger. Confirm with the user first ("Did you mean `/augmentiq save`?").

See `references/commands.md` for the full command spec. See `references/flows.md` for the goal + constraints per flow. See `references/mcp-integration.md` for the MCP wiring (when Custom backend is in use).

## 3. The 26 slash commands (one line each)

**Onboarding:**
- `/augmentiq init` — first-time questionnaire + config write. See `references/commands.md#init`.
- `/augmentiq status` — show current state. See `references/commands.md#status`.
- `/augmentiq reconfigure` — change config. See `references/commands.md#reconfigure`.
- `/augmentiq destroy` — teardown with triple confirmation. See `references/commands.md#destroy`.

**Capture:**
- `/augmentiq snapshot` — capture designated sources now. See `references/commands.md#snapshot`.
- `/augmentiq save <thing>` — save a new record. See `references/commands.md#save`.
- `/augmentiq tag <id> [tags]` — update tags. See `references/commands.md#tag`.

**Query:**
- `/augmentiq recall <query>` — semantic + keyword search. See `references/commands.md#recall`.
- `/augmentiq timeline` — show timeline events. See `references/commands.md#timeline`.
- `/augmentiq who-knows <topic>` — find records + people + dates. See `references/commands.md#who-knows`.

**Compliance:**
- `/augmentiq audit` — generate audit report. See `references/commands.md#audit`.
- `/augmentiq retention` — view/set/enforce retention. See `references/commands.md#retention`.
- `/augmentiq redact <id>` — redact content (preserves audit hash). See `references/commands.md#redact`.
- `/augmentiq dsr <id> --type=<access|erasure|rectification|portability>` — fulfill DSR. See `references/commands.md#dsr`.
- `/augmentiq role <set|get|list>` — manage role-based access. See `references/commands.md#role`.

**Migration:**
- `/augmentiq migrate --to=<backend>` — move records with lossiness report. See `references/commands.md#migrate`.
- `/augmentiq export` — portable export. See `references/commands.md#export`.
- `/augmentiq import` — load from export. See `references/commands.md#import`.

**Legacy ingest:**
- `/augmentiq ingest` — start/resume legacy ingest. See `references/commands.md#ingest`.
- `/augmentiq ingest status` / `pause` / `resume` / `retry` / `skip` / `cancel` / `report` — 7 sub-commands. See `references/commands.md#ingest`.

**Meta:**
- `/augmentiq help` — list commands. See `references/commands.md#help`.

## 4. The 10 flows (goal + constraints, per principle 4)

For each flow, the body states the **goal** and 3-5 **hard constraints** the agent must honor. The detailed procedure lives in `references/flows.md`; the agent picks the path.

- **detect** — Identify host agent, OS, and memory backend in one pass. Cache for the session. Constraint: never assume; always verify via filesystem marker or `--version` flag.
- **init** — Produce a valid `~/.augmentiq/config.yaml` + cron set. Constraint: typed user confirmation before any write.
- **capture** — Persist a new record with correct classification, tags, audit ref. Constraint: PII auto-classification runs before any write; per-action confirmation for single records, per-batch for >100.
- **retention** — Enforce retention per classification, archive or delete. Constraint: pre-destroy export is mandatory; double confirmation; never silently delete.
- **audit** — Generate quarterly audit (JSON + Markdown). Constraint: log the audit itself to the timeline.
- **migration** — Move records between backends with lossiness report. Constraint: source data preserved until user confirms target; reversible per Principle 3.
- **legacy_ingest** — Bring historical data in with per-source strategy. Constraint: enterprise platforms route to `customdev@upsurge.ae`, never auto-ingest; per-batch confirmation if `items_attempted > 100`.
- **dsr** — Fulfill data subject request. Constraint: per-action confirmation with regulatory basis (GDPR Art. 15/16/17/20 or analogous) before any destructive step.
- **failure_ux** — Surface failures with specific recovery. Constraint: never retry silently; alert on 3 consecutive failures; queued confirmations expire in 7 days.
- **destroy** — Tear down with triple confirmation. Constraint: disable crons first, then ingest, then optionally wipe; destruction log before any wipe.

## 5. The 6 cron cadences

| Cron | Fires on | Does | Confirmation |
|---|---|---|---|
| **daily-snapshot** | 02:00 daily | Capture state of designated sources | per-batch if >100 items |
| **weekly-review** | Sunday 04:00 | Surface changes, stale items | read-only, no confirmation |
| **monthly-retention** | 1st of month 03:00 | Enforce retention policy | double confirmation |
| **quarterly-audit** | last day of quarter 04:00 | Generate audit report | none (write-to-user-fs) |
| **ingest-batch** | 02:00 nightly (if any source uses nightly_batches) | Pull the next batch of legacy data | per-batch if >100 |
| **on-event** | commit / merge / decision / customer-interaction / incident / policy-change / hire / contract | Capture the event | in-session confirmation |

Per-host cron templates (Hermes YAML, OpenClaw JSON, launchd plist, systemd timer) are in `assets/cron-templates/`. The body never duplicates per-host detail.

## 6. The 5 Immutable Principles (constitution, inline)

Apply on every action. The full text + mechanisms + citations are in `references/PRINCIPLES.md`.

1. **Never write to a backend without per-action confirmation.**
2. **The host agent decides; you (the skill) suggest. The user can override.**
3. **Every action is reversible. Migration is bidirectional.**
4. **Confirm before destructive. Always offer pre-destroy export.**
5. **Audit every state change to the timeline. The timeline is portable.**

**Note on Principle 5 (v0.1):** the timeline is server-owned when the Custom backend (AugmentIQ+ via MCP) is in use. The server computes the hash chain; the Skill reads it back via `mcp_get_audit_entry` for verification. The Skill does not maintain a local `timeline.jsonl` — the server's tamper-evident SQLite table IS the timeline. See `references/mcp-integration.md` for the verification flow.

## 7. The 7-Tier Variable Schema (pointer)

Config lives in `~/.augmentiq/config.yaml`. The 7 tiers (Identity, Host, Memory, Compliance, Capture, Legacy, Advanced) and 38 variables are specified in `references/variables.md`. The user can edit YAML directly; the agent reads it on every action.

**Negative case:** the body never lists the 38 variables. The reference is the schema.

## 8. The supported set (backends + host agents)

**Backends (5, in recommended order for serious/enterprise/local-first use):**
1. **`custom`** — AugmentIQ+ via MCP. Docker-based, 100% local, server-owned tamper-evident audit, hybrid search. **Recommended for `organisation` and `department` tiers, and for any user who wants the full AugmentIQ feature set with full storage guarantees.** See `references/backends/custom.md` + `references/mcp-integration.md`.
2. `obsidian` — local-first Markdown. The default individual choice if the user already has a vault.
3. `mem0` — cloud memory layer, multi-user. The default team choice if the user already has mem0.
4. `reme` — file-based with Git-style versioning. For compliance-conscious users.
5. `hermes_native` — `~/.hermes/memories/MEMORY.md` (2200 chars) + `USER.md` (1375 chars). For Hermes users only.

Per-backend behavior in `references/backends/<name>.md`. The "when to use" section in each per-backend reference points users to Custom when the use case is serious/enterprise/local-first.

**Host agents (6+):** `hermes` (primary, MEMORY.md + USER.md), `openclaw` (secondary, has dreaming per `dreaming-systems.md`), `claude_code` (external cron), `codex` (Tier 3), `cursor` (Tier 3), `nanobot` (Tier 3). Per-host behavior in `references/agents/<name>.md`. Common patterns (detection, install, cron, slash command) in `references/agents/_common.md`.

**Negative case:** the body never duplicates per-backend or per-host quirks. The per-target reference handles the detail.

## 9. Confirmation prompt templates (reusable patterns)

The 5 principles produce 5 confirmation prompt shapes. Reuse these across all 26 commands.

**Pattern A — per-action (single record):**
```
About to save 1 record.
  Classification: <classification>
  Tags: <tags>
  Source: <source>
Proceed? [y/n]
```

**Pattern B — per-batch (bulk, >100 items):**
```
About to write <N> records to <backend>.
  Classification breakdown: <public>: <n>, <internal>: <n>, ...
  Sample 3 records: ...
  Pre-destroy export (if any) will be saved to <path>.
Type 'proceed' to confirm: _____
```

**Pattern C — per-source (legacy ingest):**
```
About to ingest source <source_id> (<source_type>, <volume_gb> GB).
  Strategy: <one_shot | nightly_batches | paused>
  Estimated: <N> nights, completion by <date>
  Routing: <direct | customdev@upsurge.ae>
Type 'proceed' to confirm: _____
```

**Pattern D — typed-for-destructive (retention, migrate, destroy, redact):**
```
About to <action>: <summary>
  Affected records: <count>
  Affected backends: <list>
  Pre-destroy export: <path>
Type '<keyword>' to confirm: _____
```

**Pattern E — double-for-destroy:**
```
Step 1: "Are you sure? Type 'destroy' to confirm."
Step 2: "This is irreversible. Type 'destroy-permanently' to confirm."
```

**The 5 principles produce 5 prompt shapes, applied across 26 commands.**

## 10. The MCP integration (when `custom` backend is in use)

When the configured backend is `custom` (AugmentIQ+ via MCP), the Skill launches the MCP server as a subprocess and communicates over stdio. The full wiring is in `references/mcp-integration.md`. The 5 tools, the 5-minute summary:

1. **Launch.** The Skill invokes `assets/mcp-launch/<host>.sh`, which runs `docker run -i augmentiq-engine`. The container's stdio becomes the MCP channel. Docker must be available on the host.
2. **Handshake.** On launch, the Skill calls `mcp_search_memory` with `limit: 0` to verify the server is responsive. If no response within 10s, the Skill aborts and tells the user to check the Docker image.
3. **Per command.** The Skill formats the canonical AugmentIQ Context Record (per `references/record-schema.md` §1) and calls the appropriate MCP tool:
   - **Writes** (`save`, `snapshot`, `tag`, `redact`): `mcp_add_memory` or `mcp_update_memory`.
   - **Reads** (`recall`, `who-knows`, `timeline`, `audit`): `mcp_search_memory`.
   - **Deletes** (`destroy --wipe-data`, `dsr --type=erasure`): `mcp_delete_memory`.
   - **Audit verification** (`audit --verify-chain`): `mcp_get_audit_entry` per record.
4. **Errors.** The server returns JSON-RPC 2.0 errors. The Skill surfaces a user-friendly message and logs the raw code to stderr. Error codes are in `references/record-schema.md` §4.
5. **Launch scripts** are in `assets/mcp-launch/<host>.sh` (5 files: hermes, openclaw, claude_code, codex, cursor). The scripts are `chmod +x` and contain the per-host environment setup.

**Hard dependency:** Docker. If the user wants the Custom backend, Docker must be installed and the `augmentiq-engine` image must be built (`docker build -t augmentiq-engine /path/to/augmentiq-plus`). For users without Docker, the 4 secondary backends (Obsidian, mem0, ReMe, Hermes native) still work.

## 11. Pointer to the v0.1 launch checklist

The shipped v0.1 package includes:
- `SKILL.md` (this file) — under 500 lines, under 5000 tokens
- `references/` — 22 typed contracts + 4 per-category ingest directives + `mcp-integration.md` (v0.1) + `record-schema.md` (v0.1) + 4 compliance packs
- `assets/questionnaires/` — 4 JSON files (individual, team, department, organisation)
- `assets/email-templates/` — DSR templates
- `assets/audit-templates/` — audit report templates
- `assets/mcp-launch/` — 5 per-host launch scripts (hermes, openclaw, claude_code, codex, cursor)
- `README.md`, `LICENSE` (MIT), `COMPATIBILITY.md`, `ECOSYSTEM_GAP_ANALYSIS.md`, `MARKETPLACE.md`, `MIGRATION_PLAYBOOK.md`, `CERTIFICATION.md`, `COMPLIANCE_POSITIONING.md`, `WEBSITE_READY.md`, `INSTALL_TEST.md`

v0.1 = done when the install test (`INSTALL_TEST.md`) passes end-to-end on a clean install.
