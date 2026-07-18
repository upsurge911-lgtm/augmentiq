# Changelog

All notable changes to AugmentIQ are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.0.1-alpha] - 2026-07-17

**Status: pre-release, work in progress. Not for production use.**

### Added

- **SKILL.md** (193 lines, 2688 tokens): the under-500-line body, structured per the 8-section outline, with 30 words of negative cases in the frontmatter and the 5 Immutable Principles inline.
- **22 reference docs** in `references/`: PRINCIPLES, variables, commands, crons, flows, plus 6 per-host-agent references (Hermes, OpenClaw, Claude Code, Codex, Cursor, nanobot), 5 per-backend references (Obsidian, mem0, ReMe, mem360, hermes_native, custom), the dreaming-systems research note, the agent detection common patterns, and the legacy ingest model (5 docs: strategies, estimator, batch protocol, PII patterns, routing).
- **4 per-category ingest directives** in `references/ingest/`: local_files, cloud_storage, standard_saas, email.
- **22 reference docs** in `references/agents/`: shared common patterns + 6 per-host.
- **4 placeholder questionnaire JSONs** in `assets/questionnaires/`: individual, team, department, organisation. (Real content lands in v0.1.0.)
- **MIT LICENSE**.

### Known limitations (the v0.0.1-alpha work that remains)

- Questionnaires are placeholders (no real questions).
- No `README.md`, no `INSTALL_TEST.md`, no live test has been run.
- No `MARKETPLACE.md`, no submission to agentskills.io.
- No compliance packs (GDPR, SOC2, HIPAA, ISO 27001).
- No `MIGRATION_PLAYBOOK.md`, no `CERTIFICATION.md`, no `COMPLIANCE_POSITIONING.md`, no `WEBSITE_READY.md`, no `ECOSYSTEM_GAP_ANALYSIS.md`, no `COMPATIBILITY.md`.
- The Custom backend (AugmentIQ+ via MCP, per Antigravity's architecture) integration is **not yet wired**: the `assets/mcp-launch/<host>.sh` scripts are not yet present, the `mcp_get_audit_log` 5th tool (per Antigravity's answer) is not yet referenced in the Skill body, the Docker launch command (`docker run -i augmentiq-engine`) is not yet documented.
- No `CHANGELOG.md` (this file is the first entry).

### Architectural notes

- **Skill contract is locked.** The 5 Immutable Principles, the 26 slash commands, the 6 cron cadences, the 7-Tier Variable Schema, the 4 scale tiers do not change between v0.0.1-alpha and v1.0.
- **AugmentIQ+ is the recommended backend for serious / enterprise / local-first use.** The other 4 backends (Obsidian, mem0, ReMe, hermes_native) are for users with existing infrastructure.
- **Per Antigravity (the platform team)**: "The MCP server entirely owns the SQLite audit timeline. You don't maintain a separate log. The install path is Docker. The launch command is `docker run -i augmentiq-engine`."

### License

MIT. See `LICENSE`.
