# AugmentIQ

> **Portable governance for AI agent memory.**
> A free, MIT-licensed Agent Skill that captures, classifies, retains, audits, and migrates your agent's context. Works with 5 backends. The recommended backend for serious / enterprise / local-first use is **AugmentIQ+** (a Docker-based MCP server). The other 4 backends (Obsidian, mem0, ReMe, Hermes native) are for users with existing infrastructure.

```bash
# Quickstart on Hermes
cp -r AugmentIQ/ ~/.hermes/skills/augmentiq/
hermes skills reload
/augmentiq help
```

**30 seconds to first value.** Built on the open Agent Skills standard — works on Hermes, OpenClaw, Claude Code, Codex, Cursor, and 30+ more spec-compliant hosts.

## What it does

- **Captures** context from your existing sources (Obsidian, mem0, ReMe, Hermes native, or AugmentIQ+) into a single classified, retained, auditable memory layer.
- **Classifies** every record as `public` / `internal` / `confidential` / `restricted`, with PII auto-upgrade.
- **Retains** per regulation (GDPR, SOC2, HIPAA, ISO 27001 — packs ship in v0.1.1).
- **Audits** every state change to a tamper-evident timeline you can export.
- **Migrates** between backends in one command with a lossiness report.

## The 5 Immutable Principles (the constitution)

These never change. Every flow, every command, every reference derives from them.

1. **We don't own your memory.** Every state-changing action needs explicit per-action confirmation.
2. **We don't own your agent.** The host agent retains full authority. The Skill suggests, you decide.
3. **Your data is yours, forever.** Every action is reversible. Migration is bidirectional. No lock-in.
4. **Confirm before destructive.** Delete, redact, expire, migrate, destroy — all need in-session confirmation.
5. **Audit everything.** Every state change is logged, queryable, exportable. Append-only, content-hashed.

The full per-principle spec is in [`references/PRINCIPLES.md`](./references/PRINCIPLES.md).

## The 5 supported backends

| Backend | When to use |
|---------|-------------|
| **AugmentIQ+** (Custom, via MCP) | **Recommended for serious / enterprise / local-first use.** Docker-based, 100% local, server-owned tamper-evident audit, hybrid search. |
| **Obsidian** | You already have a vault. The Skill adds the governance layer. |
| **mem0** | You already use mem0. The Skill adds classification, retention, audit, DSR. |
| **ReMe** | File-based with Git-style versioning. The Skill adds the rules. |
| **Hermes native** | You live in `MEMORY.md` + `USER.md`. The Skill adds classification and audit. |

**If you don't have a backend yet, use AugmentIQ+.** It's the recommended path for serious use.

## Install

### Prerequisites

- An Agent-Skills-compliant host agent: **Hermes** (primary), **OpenClaw** (secondary), **Claude Desktop**, Claude Code, Codex, Cursor, or any of 30+ spec-compliant hosts.
- A memory backend (5 supported, see above).
- For AugmentIQ+ (recommended for serious use): **Docker** must be available on the host.

### Quick start

```bash
# 1. Install the Skill on your host agent
cp -r AugmentIQ/ ~/.hermes/skills/augmentiq/
hermes skills reload

# 2. If using AugmentIQ+ (recommended for serious use):
docker build -t augmentiq-engine /path/to/augmentiq-plus

# 3. Run the questionnaire
/augmentiq init

# 4. Capture your first record
/augmentiq save "This is a test record" --tags=test,first

# 5. Search
/augmentiq recall "test"

# 6. See the audit trail
/augmentiq timeline
```

### Claude Desktop

1. Upload the skill: Settings → Customize → Skills → **+** → upload a ZIP of this repo (`SKILL.md` at the ZIP root).
2. Optional — AugmentIQ+ backend: point `claude_desktop_config.json` at the launch script:
   `{"mcpServers": {"augmentiq": {"command": "/path/to/AugmentIQ/assets/mcp-launch/claude_desktop.sh"}}}`
3. Ask Claude: "run augmentiq help"

Full install walkthrough is in [`INSTALL_TEST.md`](./INSTALL_TEST.md).

## The 26 commands

Grouped by intent. Full per-command spec is in [`references/commands.md`](./references/commands.md).

- **Onboarding** (4): `init`, `status`, `reconfigure`, `destroy`
- **Capture** (3): `snapshot`, `save`, `tag`
- **Query** (3): `recall`, `timeline`, `who-knows`
- **Compliance** (5): `audit`, `retention`, `redact`, `dsr`, `role`
- **Migration** (3): `migrate`, `export`, `import`
- **Legacy ingest** (8): `ingest` + 7 sub-commands
- **Meta** (1): `help`

## The 6 cron cadences

What makes AugmentIQ "run" without you prompting it. All configurable per `unit_type`.

| Cadence | Default | What |
|---------|---------|------|
| `daily-snapshot` | 02:00 daily | Capture state of designated sources |
| `weekly-review` | Sunday 04:00 | Surface changes, stale items |
| `monthly-retention` | 1st of month 03:00 | Enforce retention policies |
| `quarterly-audit` | Last day of quarter 04:00 | Generate the full audit report |
| `ingest-batch` | 02:00 nightly (if pending) | Pull next batch of legacy data |
| `on-event` | triggered by commit/merge/decision/incident/etc. | Capture the event |

## The 4 scale tiers

| Tier | Questions | Default scope | Default compliance |
|------|-----------|---------------|-------------------|
| **individual** | 5 | self | none |
| **team** | 11 | team | opt-in |
| **department** | 17 | department | 1 pack by default |
| **organisation** | 22 | organisation | 1-4 packs |

## When NOT to use this Skill

This Skill is the wrong tool if:

- You want a **dashboard**. AugmentIQ is a Skill, not a UI.
- You want a **SaaS**. The Skill runs on your machine against your backend. There is no hosted version in v0.1.
- You want **dreaming / memory synthesis**. The Skill does not promise dreaming in v0.1.
- You want a **memory backend**. The Skill is the governance layer, not the storage. Pick a backend first.
- You have **no source data to capture**. The Skill manages data you already have.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Host Agent    │    │  AugmentIQ v0.1 │    │   Memory        │
│  (Hermes,       │◀──▶│     Skill       │◀──▶│   Backend       │
│   OpenClaw,     │    │                 │    │                 │
│   Claude Code,  │    │  26 commands    │    │  (5 supported,  │
│   Codex, ...)   │    │  5 Principles   │    │   AugmentIQ+    │
│                 │    │  Questionnaire  │    │   recommended)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

- **The Skill** = routing + governance. Formats payloads, enforces the 5 Principles, handles confirmations.
- **The backend** = storage + compute. Holds the records, computes embeddings, runs search.
- **The host agent** = the executor. Loads the Skill, calls the commands, runs the flows.

The boundary is the 5 MCP tool signatures (for AugmentIQ+) or the per-backend adapter contract (for the 4 secondary backends). See [`references/mcp-integration.md`](./references/mcp-integration.md) and [`references/backends/custom.md`](./references/backends/custom.md).

## Pricing

- **The Skill** — free, MIT, forever.
- **Compliance packs** (GDPR, SOC2, HIPAA, ISO 27001) — paid, ship in v0.1.1.
- **Legacy migration engagement** — paid service. Starter $15-25k, Standard $25-45k, Enterprise $45-90k, Complex $90k+.
- **Consultant certification program** — paid. See the docs for details.

## License

MIT. See [`LICENSE`](./LICENSE).

## Brand context

AugmentIQ is the portable governance skill. The umbrella brand is **Agentic Augmentation**, by **Upsurge** (Advantage Technologies INC). The whitepaper is the thought-leadership piece; the Skill is the technical product. They ship together.

## See also

- [`INSTALL_TEST.md`](./INSTALL_TEST.md) — end-to-end install + smoke test
- [`references/PRINCIPLES.md`](./references/PRINCIPLES.md) — the 5 Immutable Principles (full spec)
- [`references/commands.md`](./references/commands.md) — all 26 commands
- [`SKILL.md`](./SKILL.md) — the Skill body the host agent loads
- [Agent Skills spec](https://agentskills.io) — the open standard this Skill implements

---

**© 2026 Advantage Technologies INC (Upsurge). The AugmentIQ Skill is MIT-licensed. The 4 compliance packs are paid. The migration engagement and the consultant certification are paid services.**
