# Changelog

All notable changes to AugmentIQ are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-10-24

### Unreleased — the AugmentiQ Obsidian plugin (consumer product)
- Embedded MCP server (127.0.0.1:3710, streamable HTTP, bearer auth) inside an Obsidian plugin — one install, zero Docker
- 10 tools: the 5 contract tools (per `references/record-schema.md`) + consumer tools `memory`/`vault`/`edit`/`graph`/`system`
- Hash-chained audit log in `.augmentiq/audit.log`; store in `.augmentiq/memories.jsonl` (Context Records per record-schema.md §1)
- Read-only mode; delete-to-trash; lexical recall scoring (embeddings v1.1)
- Backend reference: `references/backends/obsidian-plugin.md`
- Deployed and dogfooding on the Robin's Brain vault since 2026-10-24 — 22/22 smoke checks, audit chain verified

### Added
- **Claude Desktop** as a supported host (Tier 2): `references/agents/agent-claude_desktop.md`, `assets/mcp-launch/claude_desktop.sh`, install guide (`docs/public/install/claude-desktop.md`)
- **`references/record-schema.md`** — the canonical types: Context Record, Timeline entry, the 5 MCP tool signatures, JSON-RPC error codes (completes the v0.1 contract)
- **Cron templates** (`assets/cron-templates/`): Hermes YAML, OpenClaw JSON, launchd plist, systemd units
- **DSR email templates** (`assets/email-templates/`) and **quarterly audit report template** (`assets/audit-templates/`)
- **Public install docs** for all supported hosts (`docs/public/`)

### Changed
- **Custom backend re-cut as AugmentIQ+ via MCP** — Docker-based, 100% local, server-owned tamper-evident audit; recommended for serious / enterprise / local-first use; the user-implemented adapter pattern is deferred to v0.2
- `references/` backends reorganized under `references/backends/`
- README, SKILL.md, INSTALL_TEST.md rewritten for v0.1; **server-owned audit timeline** (Principle 5 note)
- Repository credentials moved off the remote URL (credential helper)

### Fixed
- Stale cross-references corrected (ingest model doc paths, agent doc paths, `ingest/sources/` paths)
- SKILL.md package-contents list trimmed to what actually ships

### Removed
- **PRD.md** — superseded by `INSTALL_TEST.md` (recoverable in git history)

## [0.0.1-alpha] — 2026-07-17

**Status: pre-release, work in progress. Not for production use.**

### Added
- **SKILL.md** (193 lines, 2688 tokens): the under-500-line body, structured per the 8-section outline, with 30 words of negative cases in the frontmatter and the 5 Immutable Principles inline.
- **22 reference docs** in `references/`: PRINCIPLES, variables, commands, crons, flows, plus 6 per-host-agent references (Hermes, OpenClaw, Claude Code, Codex, Cursor, nanobot), 5 per-backend references (Obsidian, mem0, ReMe, mem360, hermes_native, custom), the dreaming-systems research note, the agent detection common patterns, and the legacy ingest model (5 docs: strategies, estimator, batch protocol, PII patterns, routing).
- **4 per-category ingest directives** in `references/ingest/`: local_files, cloud_storage, standard_saas, email.
- **4 questionnaire JSONs** in `assets/questionnaires/`: individual, team, department, organisation.
- **MIT LICENSE**.

### Known limitations (superseded by 0.1.0)
- Questionnaires were placeholders (real content landed with the v0.0.1-alpha commit of 2026-07-18 and the v0.1 wave).
- Compliance packs (GDPR, SOC2, HIPAA, ISO 27001) — ship in v0.1.1.
- MARKETPLACE, MIGRATION_PLAYBOOK, CERTIFICATION, COMPLIANCE_POSITIONING, WEBSITE_READY, ECOSYSTEM_GAP_ANALYSIS, COMPATIBILITY docs — planned, not yet shipped.

### Architectural notes
- **Skill contract locked:** the 5 Immutable Principles, the 26 slash commands, the 6 cron cadences, the 7-Tier Variable Schema, the 4 scale tiers do not change between v0.0.1-alpha and v1.0.
- **AugmentIQ+ is the recommended backend for serious / enterprise / local-first use.** The other 4 backends (Obsidian, mem0, ReMe, hermes_native) are for users with existing infrastructure.
- **The MCP server entirely owns the SQLite audit timeline.** The install path is Docker; the launch command is `docker run -i augmentiq-engine`.