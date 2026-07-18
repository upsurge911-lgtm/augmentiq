# AugmentIQ

> **Status: v0.0.1-alpha — work in progress. Not for production use.**
> See [CHANGELOG.md](./CHANGELOG.md) for what's done and what's pending.

A portable Agent Skill that helps legacy companies become AI-native by transferring years of historical data into a memory backend of their choice. Solves the memory and context problem. Free, MIT, open standard.

**For:** legacy enterprises with 10+ years of context scattered across Salesforce, SharePoint, email, Drive, Notion, Confluence, ERP, and local files. The agents can use the context if the context is in agent-friendly form. AugmentIQ is the bridge.

**Recommended for serious / enterprise / local-first use:** the **Custom** backend (AugmentIQ+ via MCP server, per Antigravity's architecture). The other 4 backends (Obsidian, mem0, ReMe, hermes_native) are for users with existing infrastructure.

---

## 5 Immutable Principles (the constitution)

1. **We don't own your memory.** Every state-changing action needs explicit per-action confirmation.
2. **We don't own your agent.** The host agent decides; the skill suggests.
3. **Your data is yours, forever.** Every action is reversible. Migration is bidirectional.
4. **Confirm before destructive.** Delete, redact, expire, skip, migrate, cancel, destroy — all need in-session confirmation.
5. **Audit everything.** Every state change is logged to the timeline.

---

## What's in v0.0.1-alpha

- `SKILL.md` — 193 lines, 2688 tokens, 10 sections, 26 command references, the 5 Immutable Principles inline.
- `references/` — 22 typed contracts (the 26 slash command specs, the 6 cron cadences, the 10 operational flows, the 7-Tier Variable Schema, the per-host and per-backend references).
- `references/ingest/` — 4 per-category ingest directives for legacy data sources.
- `assets/questionnaires/` — 4 placeholder JSONs (real content lands in v1.0).
- `LICENSE` — MIT.
- `CHANGELOG.md` — this release's known limitations.

## What is NOT yet in v0.0.1-alpha

- Real questionnaire content.
- README (this file is a placeholder).
- INSTALL_TEST.md and a passing live test on Hermes / OpenClaw.
- agentskills.io marketplace submission.
- The 4 compliance packs (GDPR, SOC2, HIPAA, ISO 27001).
- The MIGRATION_PLAYBOOK, CERTIFICATION, COMPLIANCE_POSITIONING, WEBSITE_READY docs.
- The Custom (AugmentIQ+ via MCP) integration: the `assets/mcp-launch/<host>.sh` launch scripts and the `mcp_get_audit_log` 5th-tool reference (per Antigravity's architecture).

See `CHANGELOG.md` for the full list.

---

## Quickstart (current state — assumes the user has Hermes installed)

1. `cp -r AugmentIQ/ ~/.hermes/skills/augmentiq/`
2. Restart Hermes (or run `hermes skills reload`).
3. In a new chat, type `/augmentiq help`.

**Note:** the placeholder questionnaires mean `/augmentiq init` will not work yet. The install test (todo 22) has not been run. The skill is structurally complete; its behavior in a live session is unverified.

---

## Architecture (per Antigravity's MCP design)

- **The Skill is routing + governance.** It formats per-command JSON payloads, enforces the 5 principles, handles confirmations, and owns the slash command surface.
- **The MCP server (AugmentIQ+) is storage + compute.** It owns the SQLite tamper-evident audit timeline, LanceDB vector storage, Tree-sitter AST chunking, bi-temporal stamping, and hybrid search. The Skill does not implement any of these.
- **The 4 MCP tools** (per Antigravity): `mcp_add_memory`, `mcp_search_memory`, `mcp_update_memory`, `mcp_delete_memory`. A 5th tool, `mcp_get_audit_log(record_id)`, is added per Antigravity's response to the audit-hash-chain question.
- **Install path:** `docker run -i augmentiq-engine` (per Antigravity).
- **The Skill's launch scripts** (in `assets/mcp-launch/<host>.sh`) are not yet present in this alpha.

---

## Project context

- **Brand:** AugmentIQ is the portable governance skill. The umbrella brand is "Agentic Augmentation" (Upsurge.ae). The whitepaper is the thought-leadership piece (parallel project).
- **License:** MIT.
- **Spec compliance:** the Agent Skills open standard. The skill loads in any spec-compliant host agent (Hermes, OpenClaw, Claude Code, Codex, Cursor, nanobot, +30 more).
- **No lock-in:** the skill itself is content, not code. The user owns their data, their config, their backend. They can fork, modify, self-host, switch backends, and re-deploy in one command.

---

## Provenance

- The Skill was designed and built by Robin (Amit's AI operator) over 2 sessions in July 2026.
- The Custom backend (AugmentIQ+) is built by Antigravity (the platform team) per the architectural agreement between Robin and Antigravity documented in `agentic-augmentation-launch/AUGMENTIQ-ANTIGRAVITY-HANDSHAKE.md` and `AUGMENTIQ-ANTIGRAVITY-RESPONSE.md`.
- The Skill applies 6 best-practices principles for writing effective Agent Skills (per Anthropic's `skill-creator` doc): directives, why/how/when, negative cases, goals not steps, lean+layered, no no-ops.

---

**Don't use this in production.** v0.0.1-alpha is a snapshot of the build, not a release. The next target is v1.0.0, which adds the 4 questionnaire JSONs, README, INSTALL_TEST, MARKETPLACE submission, and the AugmentIQ+ MCP integration.
