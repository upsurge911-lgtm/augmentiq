# Agent: Cursor

> **Status:** per-host reference. Detection, install path, cron format,
> and slash command convention are in `agent-_common.md`. This doc
> contains only the host-specific content for Cursor.

## What Cursor is

Cursor (https://cursor.com) is an AI-first code editor built on top
of VS Code. It has native AI features (Cmd-K for inline editing,
Composer for multi-file changes, an integrated chat agent).

**Key features (relevant to AugmentIQ):**
- VS Code-compatible (extensions, settings, keybindings)
- Native AI agent (the "Cursor Agent")
- Slash commands: `/augmentiq <subcommand>`
- File editing, search, terminal (via VS Code)

## Detection, install, cron, slash command

See `agent-_common.md` for the common pattern. Cursor specifics:
- **Marker:** `~/.cursor/` directory
- **Skill path:** `~/.cursor/skills/augmentiq/SKILL.md` (assumed, verify with Cursor docs)
- **Cron:** external (launchd). Cursor is macOS/Windows-focused.
- **Slash commands:** in Cursor's AI chat (Cmd-L or Cmd-I).

## Native tool set (relevant to AugmentIQ)

- **File editing**: native editor (Cmd-K for inline, Composer for multi-file)
- **Search**: VS Code's search (ripgrep-based)
- **Terminal**: VS Code's terminal
- **Web**: limited (web fetch in some versions)

AugmentIQ uses these tools via the skill's directives.

## Known quirks

### Cursor's AI agent is integrated into the editor

The AI agent runs in the editor's context, with full access to the
open files, the workspace, and the terminal. This is convenient
but means the agent can make file edits without explicit user
approval (per Cursor's default behavior).

AugmentIQ's Principle 4 (per-action confirmation) applies
especially strongly here. The agent must show a confirmation
prompt before any destructive action, even if Cursor's default
behavior would skip it.

### Subscription tier

Cursor has Free, Pro, Business, and Enterprise tiers. The Free
tier has limited AI usage; Pro is sufficient for individual use.

### Skill support is new

Cursor's skill support is being added. The exact convention may
shift. AugmentIQ's v0.1 supports the assumed convention; v0.2
will update based on Cursor's actual release.

## Compatibility

| AugmentIQ feature | Cursor support | Notes |
|---|---|---|
| Install as a skill | ⚠️ Assumed | Verify with Cursor's docs |
| Cron scheduling | ⚠️ External | launchd |
| Slash commands | ✅ | Cursor's chat |
| Read/write files | ✅ | VS Code's editor |
| Search files | ✅ | VS Code's search |
| Terminal access | ✅ | VS Code's terminal |
| Web access | ⚠️ Limited | Some versions only |
| Subagents | ❌ | Not supported |
| Multi-agent orchestration | ❌ | Not supported |

**Cursor is in Tier 3 of AugmentIQ's host agent support matrix.**
It works for individual and small-team use, but lacks native
multi-agent support and has limited cron.

## Sources

- Cursor website: https://cursor.com
- Cursor docs: https://docs.cursor.com
- Agent Skills spec: https://agentskills.io/specification
  (the assumed convention)
