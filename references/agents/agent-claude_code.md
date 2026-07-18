# Agent: Claude Code

> **Status:** per-host reference. Detection, install path, cron format,
> and slash command convention are in `agent-_common.md`. This doc
> contains only the host-specific content for Claude Code.

## What Claude Code is

Claude Code is Anthropic's local-first CLI agent for software
engineering. It runs in the user's terminal, has native tools for
file editing, search, terminal, and is designed for production use.

**Source for Claude Code:** https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
(per the Agent Skills spec, which Claude Code implements).

## Detection, install, cron, slash command

See `agent-_common.md` for the common pattern. Claude Code specifics:
- **Marker:** `~/.claude/` directory
- **Skill path:** `~/.claude/skills/augmentiq/SKILL.md` (canonical, per the Agent Skills spec)
- **Cron:** external (launchd, systemd, or crontab). No native cron.
- **Slash commands:** per the spec; the agent parses the `commands:` frontmatter.

## Native tool set (relevant to AugmentIQ)

- **File editing**: `Read`, `Write`, `Edit` (Anthropic's tool names)
- **Search**: `Grep`, `Glob`
- **Terminal**: `Bash`
- **Web**: `WebFetch`, `WebSearch`

AugmentIQ uses these tools via the skill's directives. The agent runs them on the user's behalf.

## Known quirks

### No native cron

Claude Code doesn't have native cron. External scheduling is
required. The agent generates the plist / timer / crontab on init
and instructs the user to install it.

Mitigation: the agent provides a one-line install command per cadence (e.g., `launchctl load ~/Library/LaunchAgents/...`).

### Skill discovery

Claude Code discovers skills from `~/.claude/skills/`. The user
must restart Claude Code after installing AugmentIQ for the skill
to be discovered (or run `claude skill reload`).

### Subscription tier

Claude Code is available on Anthropic's Pro, Max, Team, and
Enterprise tiers. The Pro tier is sufficient for individual use.
Team and Enterprise are needed for organisation-scale deployments.

For organisations, the user must have a Team or Enterprise
subscription. The agent checks the subscription tier on init
and refuses to install if it's incompatible.

### Token limits

Claude Code has per-session token limits (depends on the
subscription tier). For long-running operations (e.g., legacy
ingest), the user may hit the limit. Mitigation: the agent
saves progress to the timeline and can resume on a new session.

## Compatibility

| AugmentIQ feature | Claude Code support | Notes |
|---|---|---|
| Install as a skill | ✅ | Per the Agent Skills spec |
| Cron scheduling | ⚠️ External | launchd / systemd / crontab |
| Slash commands | ✅ | Per the spec |
| Read/write files | ✅ | `Read`, `Write`, `Edit` |
| Search files | ✅ | `Grep`, `Glob` |
| Terminal access | ✅ | `Bash` |
| Web access | ✅ | `WebFetch`, `WebSearch` |
| Subagents | ⚠️ Limited | Per-session token limits |
| Multi-agent orchestration | ❌ | Not natively supported |

**Cron is external, subagents are limited, multi-agent is not
supported.** For v0.1, individual use cases are fully supported;
organisation use cases are limited.

## Sources

- Claude Code docs: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
- Anthropic engineering blog: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Agent Skills spec: https://agentskills.io/specification
