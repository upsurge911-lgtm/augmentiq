# Agent: Hermes

> **Status:** per-host reference (primary). Detection, install path,
> cron format, and slash command convention are in `agent-_common.md`.
> This doc contains only the host-specific content for Hermes, plus
> the integration story.

## What Hermes is

Hermes is the local-first AI agent that the user runs on
macOS. It's the host that loads AugmentIQ as a skill and executes
the directives. Hermes has its own memory, its own tool set, its own
cron system.

**Source for Hermes:** the user's session context (Hermes is the
agent running this skill right now). The exact version, install
path, and feature set are per the user's install.

## Detection, install, cron, slash command

See `agent-_common.md` for the common pattern. Hermes specifics:
- **Marker:** `~/.hermes/` directory
- **Skill path:** `~/.hermes/skills/augmentiq/SKILL.md`
- **Cron:** native (YAML files in `~/.hermes/cron/augmentiq-*.yaml`)
- **Slash commands:** Hermes parses the `commands:` frontmatter of the SKILL.md directly.

## Native tool set (relevant to AugmentIQ)

Hermes provides: `read_file`, `write_file`, `patch`, `search_files`,
`terminal`, `delegate_task`, `cronjob`, `execute_code`, `browser_*`,
`vision_analyze`. AugmentIQ uses these via the skill's directives.

## Known quirks (from the user's session context)

- **Terminal `hi` transient:** the first `terminal` call after
  startup sometimes returns a `FileNotFoundError: hi`. Warm up with
  `echo ok` first.
- **`vision_analyze` rejects local paths:** accepts URLs and data
  URLs, not local paths. Convert to `file://` or `data:` URL first.
- **`write_file` on sibling-subagent path warns** but overwrites.
  Re-read to verify.
- **RAM constraints:** local LLM sizes are limited by available RAM. For specific sizing, check the Hermes project's published specs.
- **`read_file` 100KB limit:** for larger files, use `terminal` with
  `cat` / `head` / `tail` in chunks.

These are local-install quirks. AugmentIQ directives should account
for the ones that affect record writes (terminal warm-up, read
chunking).

## File system markers

See `agent-_common.md` for the standard markers. Hermes-specific:
```
~/.hermes/
  MEMORY.md         # Hermes's curated long-term memory
  DREAMS.md         # user-maintained file (NOT a system feature — see `dreaming-systems.md`)
  memory/
    YYYY-MM-DD.md   # daily log files
  .augmentiq/       # created by AugmentIQ on first init
  config.yaml       # Hermes's own config (separate from AugmentIQ's)
  cron/
    augmentiq-*.yaml
```

## The "Hermes + AugmentIQ" integration story

For the user, the value of Hermes + AugmentIQ:

1. **Hermes is the host.** It runs the crons, executes the commands, talks to the memory backend.
2. **AugmentIQ is the playbook.** It tells Hermes what to do, when, why, and how to record it.
3. **The user gets a self-improving agent.** Hermes learns from the timeline (what worked, what didn't). AugmentIQ's audit log becomes the agent's long-term context for decisions.

**The user is the operator.** They run Hermes, they install AugmentIQ, they configure the crons, they review the audit log.

**AugmentIQ does not replace Hermes.** It augments it.

## Compatibility

| AugmentIQ feature | Hermes support | Notes |
|---|---|---|
| Install as a skill | ✅ | Per the Agent Skills spec |
| Cron scheduling | ✅ | YAML cron files |
| Slash commands | ✅ | Per the spec's `commands:` frontmatter |
| Read/write files | ✅ | `read_file`, `write_file`, `patch` |
| Search files | ✅ | `search_files` (ripgrep) |
| Terminal access | ✅ | `terminal` (with quirks) |
| Subagents | ✅ | `delegate_task` (max 50 calls per session) |
| Python execution | ✅ | `execute_code` |
| Browser access | ✅ | `browser_*` |
| Image analysis | ✅ | `vision_analyze` (with quirks) |
| Embedding generation | ✅ | Via `execute_code` (using the user's chosen model) |
| Web search | ✅ | `web_search` (for some lookups) |

**All v0.1 features are supported on Hermes.** AugmentIQ's primary development and testing target is Hermes.

## Sources

- The Agent Skills spec: https://agentskills.io/specification
- Hermes session context: per the user's MEMORY.md and the active session state.
- User's MEMORY.md (system prompt): for Hermes quirks and the local LLM sizing.
- `~/.hermes/config.yaml` and `~/.hermes/SOUL.md` for the local install.
