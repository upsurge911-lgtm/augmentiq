# Agent: nanobot (and other Tier 3 agents)

> **Status:** per-host reference (Tier 3). Detection, install path,
> cron format, and slash command convention are in `agent-_common.md`.
> This doc contains only the host-specific content for nanobot, plus
> the Tier 3 strategy.

## What nanobot is

nanobot is an experimental agentic platform with a heavy focus on
MCP (Model Context Protocol) integration. It's under active
development, with the maintainer indicating the project is "moving
away from the original design."

**Source for nanobot:** the nanobot repo
(https://github.com/nanobot-ai/nanobot), per the pulled README.

**Status note:** the project is in flux. The exact install path,
skill convention, and feature set may shift. AugmentIQ's v0.1
supports the current convention; v0.2 will update based on
nanobot's actual release.

## Detection, install, cron, slash command

See `agent-_common.md` for the common pattern. nanobot specifics:
- **Marker:** `~/.nanobot/` directory
- **Skill path:** `~/.nanobot/skills/augmentiq/SKILL.md` (assumed, verify with nanobot docs)
- **Cron:** unclear, may or may not be supported. v0.1 falls back to external (launchd, systemd).
- **Slash commands:** not yet standardized. Assumed the `commands:` frontmatter convention.

## Native tool set (relevant to AugmentIQ)

- **MCP integration**: heavy focus on MCP servers
- **File editing**: read/write files
- **Search**: ripgrep-based
- **Terminal**: shell execution

AugmentIQ uses these tools via the skill's directives. **MCP
integration is a v0.2 feature.**

## Known quirks

### Project is in flux

The maintainer is "moving away from the original design." Features
may shift between minor versions. AugmentIQ's v0.1 supports the
current state; v0.2 will update.

### Skill convention not standardized

The exact skill path and convention is not yet stable. AugmentIQ
assumes a similar convention to other agents; v0.2 will update.

### MCP-heavy

nanobot's heavy focus on MCP means many operations go through MCP
servers. AugmentIQ can use MCP for backends, scheduling, and
notifications. v0.2.

## Compatibility

| AugmentIQ feature | nanobot support | Notes |
|---|---|---|
| Install as a skill | ⚠️ Assumed | Verify with nanobot's docs |
| Cron scheduling | ⚠️ External / unclear | launchd / systemd fallback |
| Slash commands | ⚠️ Assumed | Verify with nanobot's docs |
| Read/write files | ✅ | nanobot's native tools |
| Search files | ✅ | ripgrep-based |
| Terminal access | ✅ | nanobot's native terminal |
| MCP integration | ⚠️ Future | v0.2 enhancement |
| Subagents | ❌ | Not supported |
| Multi-agent orchestration | ❌ | Not supported |

**nanobot is in Tier 3 of AugmentIQ's host agent support matrix.**
It's experimental, expect minor compatibility work.

## Other Tier 3 agents (brief)

- **Letta (letta-code)**: Active, but the skill convention is custom (not the Agent Skills spec). v0.1 supports basic install; v0.2 will add full cron + multi-agent support.
- **Claude Desktop**: Has the Agent Skills spec support. Similar to Claude Code but with a GUI shell. External cron. No terminal access.
- **Windsurf** (Codeium): similar to Cursor, VS Code fork.
- **Continue.dev**: open-source, VS Code extension.
- **PearAI**: open-source, VS Code fork.
- **Zed** (with AI features): newer editor.

All of these are in Tier 3. The user can install AugmentIQ as
a skill, but compatibility is best-effort.

## The Tier 3 strategy

For Tier 3 agents, AugmentIQ's strategy is:
1. Provide the SKILL.md in the spec-compliant format.
2. Document the install path (assumed convention).
3. Note the quirks in the per-agent reference.
4. Invite contributions from the agent's maintainers.
5. Update based on real-world feedback as users try the install.

The Tier 3 agents may shift to Tier 2 or Tier 1 as their skill
conventions stabilize.

## Sources

- nanobot GitHub: https://github.com/nanobot-ai/nanobot
- nanobot README: per the pulled file at `/tmp/aug-docs/nanobot-readme.md`
- Agent Skills spec: https://agentskills.io/specification (the assumed convention)
