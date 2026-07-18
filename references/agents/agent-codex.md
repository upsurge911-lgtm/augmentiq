# Agent: OpenAI Codex CLI

> **Status:** per-host reference. Detection, install path, cron format,
> and slash command convention are in `agent-_common.md`. This doc
> contains only the host-specific content for OpenAI Codex CLI.

## What Codex CLI is

Codex CLI is OpenAI's local-first coding agent. It runs in the user's
terminal, has native tools for file editing, search, terminal, and
is available in VS Code, Cursor, Windsurf, the desktop app, and the
web.

**Source for Codex CLI:** the OpenAI Codex repo
(https://github.com/openai/codex), per the pulled README.

**Key features (relevant to AugmentIQ):**
- Local-first (runs on the user's machine)
- Available in multiple surfaces (CLI, VS Code, Cursor, Windsurf,
  desktop app, web)
- Native tools: file editing, search, terminal
- Subscription: ChatGPT Pro, Plus, Team, Business, Enterprise, Edu

## Detection, install, cron, slash command

See `agent-_common.md` for the common pattern. Codex CLI specifics:
- **Marker:** `~/.codex/` directory
- **Skill path:** `~/.codex/skills/augmentiq/SKILL.md` (assumed, verify with Codex docs)
- **Cron:** external (launchd, systemd). No native cron.
- **Slash commands:** assumed, verify with Codex docs.

## Native tool set (relevant to AugmentIQ)

- **File editing**: read, write, edit files
- **Search**: ripgrep-based search
- **Terminal**: shell execution
- **Web**: limited (web search may be available in some versions)

AugmentIQ uses these tools via the skill's directives.

## Known quirks

### Subscription tier

Codex CLI is available on ChatGPT Pro, Plus, Team, Business,
Enterprise, Edu tiers. The Pro tier is sufficient for individual
use. Team and Business are needed for team deployments.

### Multi-surface

Codex is available in multiple surfaces (CLI, VS Code, Cursor,
Windsurf, desktop, web). The AugmentIQ skill is the same across
surfaces — the install path is per surface.

### Skill support is new

Codex's skill support is being added. The exact convention may
shift. AugmentIQ's v0.1 supports the assumed convention; v0.2
will update based on Codex's actual release.

### Token limits

Codex has per-session token limits (depends on the subscription
tier). For long-running operations, the user may hit the limit.
Mitigation: the agent saves progress and can resume.

## Compatibility

| AugmentIQ feature | Codex support | Notes |
|---|---|---|
| Install as a skill | ⚠️ Assumed | Per the Agent Skills spec; verify with Codex's docs |
| Cron scheduling | ⚠️ External | launchd / systemd / crontab |
| Slash commands | ✅ Assumed | Per the spec |
| Read/write files | ✅ | Codex's native tools |
| Search files | ✅ | ripgrep-based |
| Terminal access | ✅ | Codex's native terminal |
| Web access | ⚠️ Limited | Some versions only |
| Subagents | ❌ | Not supported |
| Multi-agent orchestration | ❌ | Not supported |

**Codex is in Tier 3 of AugmentIQ's host agent support matrix.**
It works for individual and small-team use, but lacks native
multi-agent support and has limited cron.

## Sources

- OpenAI Codex repo: https://github.com/openai/codex
- OpenAI Codex README: per the pulled file at
  `/tmp/aug-docs/codex-readme.md`
- Agent Skills spec: https://agentskills.io/specification
  (the assumed convention)
