# Agent: OpenClaw

> **Status:** per-host reference (secondary). Detection, install path,
> cron format, and slash command convention are in `agent-_common.md`.
> This doc contains only the host-specific content for OpenClaw, plus
> the integration story.

## What OpenClaw is

OpenClaw is an open-source agentic platform for building, orchestrating,
and running multi-agent workflows. It's designed for production
deployments where multiple agents collaborate on complex tasks.

**Source for OpenClaw:** https://github.com/openclaw/openclaw (the
canonical OpenClaw repo, per the pulled README).

**Key features (relevant to AugmentIQ):**
- Skills-based architecture (compatible with the Agent Skills spec)
- Multi-agent orchestration
- Native tools: browser, canvas, nodes, cron, sessions
- Discord and Slack integration
- Configurable via `~/.openclaw/openclaw.json`
- Workspace at `~/.openclaw/workspace/`

**Notable:** OpenClaw has a documented dreaming system (per
https://docs.openclaw.ai/concepts/dreaming). AugmentIQ does not
interact with it — the host agent's memory system is the host's
business. See `dreaming-systems.md` for the directive.

## Detection, install, cron, slash command

See `agent-_common.md` for the common pattern. OpenClaw specifics:
- **Marker:** `~/.openclaw/` directory
- **Skill path:** `~/.openclaw/workspace/skills/augmentiq/SKILL.md`
- **Cron:** native (JSON entries in `~/.openclaw/openclaw.json` under the `cron` key)
- **Slash commands:** via the skill's `commands:` frontmatter; OpenClaw loads the skill and dispatches.

## Native tool set (relevant to AugmentIQ)

- **`browser`**: web access. For cloud backend API calls.
- **`canvas`**: visual workspace. For showing the user the audit log, the records, the migration report.
- **`nodes`**: orchestration. For multi-agent coordination.
- **`cron`**: scheduling. To register AugmentIQ crons.
- **`sessions`**: session state. To track per-user state, per-team state.
- **`discord` / `slack`**: messaging. For webhook notifications.
- File system, search, shell, browser — same as Hermes.

## Multi-agent orchestration

OpenClaw is designed for multi-agent setups. AugmentIQ supports this in two ways:

1. **AugmentIQ as a single skill, multiple agents:** OpenClaw can
   load AugmentIQ for each agent in the orchestration. Each agent
   has its own AugmentIQ config.
2. **AugmentIQ as the orchestrator:** AugmentIQ's directive can
   spawn subagents (via OpenClaw's `nodes` tool) for batch
   processing, large migrations, etc.

For v0.1, single-agent is the primary use case. Multi-agent
orchestration is a v0.2 feature.

## File system markers

See `agent-_common.md` for the standard markers. OpenClaw-specific:
```
~/.openclaw/
  openclaw.json        # OpenClaw's config
  workspace/
    skills/augmentiq/
    AGENTS.md
    SOUL.md
    TOOLS.md
  cron/
  sessions/
```

## The "OpenClaw + AugmentIQ" integration story

For the user, the value of OpenClaw + AugmentIQ:

1. **OpenClaw is the host.** It runs the crons, executes the commands, talks to the memory backend.
2. **AugmentIQ is the playbook.** It tells OpenClaw what to do, when, why, and how to record it.
3. **The user gets a multi-agent system.** OpenClaw's orchestration + AugmentIQ's governance = multiple agents working on tasks, sharing context, and audit their work.

**The user is the operator.** They run OpenClaw, they install AugmentIQ, they configure the crons, they review the audit log.

**AugmentIQ does not replace OpenClaw.** It augments it.

## Compatibility

| AugmentIQ feature | OpenClaw support | Notes |
|---|---|---|
| Install as a skill | ✅ | Per the Agent Skills spec |
| Cron scheduling | ✅ | Via `openclaw.json` |
| Slash commands | ✅ | Per the spec's `commands:` frontmatter |
| Read/write files | ✅ | OpenClaw's file tools |
| Search files | ✅ | OpenClaw's search tools |
| Terminal access | ✅ | OpenClaw's terminal |
| Subagents | ✅ | Via `nodes` tool |
| Multi-agent orchestration | ✅ | OpenClaw's `nodes` |
| Browser access | ✅ | OpenClaw's `browser` |
| Canvas (visualization) | ✅ | OpenClaw's `canvas` |
| Discord / Slack integration | ✅ | OpenClaw's `discord` / `slack` |
| Webhook notifications | ✅ | Via Discord / Slack |

**All v0.1 features are supported on OpenClaw.** AugmentIQ's
secondary development and testing target is OpenClaw.

## Sources

- OpenClaw GitHub: https://github.com/openclaw/openclaw
- OpenClaw README: per the pulled file at `/tmp/aug-docs/openclaw-readme.md`
- OpenClaw dreaming doc: https://docs.openclaw.ai/concepts/dreaming
- Agent Skills spec: https://agentskills.io/specification
