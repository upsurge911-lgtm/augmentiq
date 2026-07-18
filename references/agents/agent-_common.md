# Agent Detection & Install (Common Patterns)

> **Status:** shared reference. Loaded once per session, used by all
> per-host-agent docs. The per-host docs (`agent-hermes.md`,
> `agent-openclaw.md`, etc.) reference this file for the boilerplate
> and contain only the host-specific content.

## How the agent detects the host (common pattern)

1. Look for a filesystem marker directory unique to the host.
2. Look for the host's binary on the PATH.
3. Confirm by reading the host's version file (if it ships one).
4. If detection succeeds, set `host_agent` in the config.
5. If detection fails, ask the user to confirm manually.

**Markers by host:**

| Host | Marker directory | Binary | Version probe |
|---|---|---|---|
| Hermes | `~/.hermes/` | `hermes` | `hermes --version` |
| OpenClaw | `~/.openclaw/` | `openclaw` | `openclaw --version` |
| Claude Code | `~/.claude/` | `claude` | `claude --version` |
| OpenAI Codex | `~/.codex/` | `codex` | `codex --version` |
| Cursor | `~/.cursor/` | (desktop app) | check app version |
| nanobot | `~/.nanobot/` | `nanobot` | `nanobot --version` |
| Letta (letta-code) | `~/.letta/` | `letta` | `letta --version` |

## How the agent loads the skill (common pattern)

The AugmentIQ skill is installed as a `SKILL.md` at the host's canonical
skill path:

| Host | Canonical skill path |
|---|---|
| Hermes | `~/.hermes/skills/augmentiq/SKILL.md` |
| OpenClaw | `~/.openclaw/workspace/skills/augmentiq/SKILL.md` |
| Claude Code | `~/.claude/skills/augmentiq/SKILL.md` |
| OpenAI Codex | `~/.codex/skills/augmentiq/SKILL.md` (assumed, verify with Codex docs) |
| Cursor | `~/.cursor/skills/augmentiq/SKILL.md` (assumed, verify with Cursor docs) |
| nanobot | `~/.nanobot/skills/augmentiq/SKILL.md` (assumed, verify with nanobot docs) |
| Letta | (custom, see `agent-letta.md` if/when written) |

**The user installs via:** `cp -r AugmentIQ/ <host_skill_path>/augmentiq/`
or via the host's skill installer (when one exists).

## How the agent registers the crons (common pattern)

| Host | Cron system | Registration |
|---|---|---|
| Hermes, OpenClaw, Letta | Native | YAML/JSON file in the host's cron dir |
| Claude Code, Codex, Cursor, nanobot | External | launchd plist (macOS) or systemd timer (Linux) |

For external-cron hosts, the agent generates a launchd plist or systemd
timer on init and instructs the user to install it. The per-host
templates are in `assets/cron-templates/`.

## Slash command convention (common pattern)

All hosts use slash commands (e.g., `/augmentiq init`). The convention:

1. The skill's `SKILL.md` defines the commands in the `commands:`
   frontmatter (per the Agent Skills spec).
2. The user invokes via `/augmentiq <subcommand> <args>`.
3. The host loads the skill and dispatches to the appropriate directive.

The per-host dispatch implementation may vary (Claude Code uses its
own slash command system; OpenClaw uses its skills loader; Hermes
parses the SKILL.md body directly). The AugmentIQ commands are the
same across all hosts.

## File system markers (common pattern)

For every host, AugmentIQ writes its state to:

```
~/.augmentiq/
  config.yaml          # the canonical config (7-Tier Schema)
  crons.yaml           # the cron registry
  timeline.jsonl       # the append-only audit log
  embeddings/          # one .json per record (the vector + id)
  audits/              # per-quarter audit reports (.json + .md)
  exports/             # per-export files (.jsonl)
  migrations/          # per-migration lossiness reports
  dsr/                 # per-DSR completion reports
  destroyed/           # per-destroy logs
  logs/                # per-cron stdout/stderr
```

The per-host install path for the skill itself is in the table above.

## Version probe (common pattern)

The agent detects the host's version via the host's `--version` flag.
The minimum supported version is host-specific. For all current
versions of all supported hosts, AugmentIQ v0.1 is supported.

## Why this doc exists

This doc captures the boilerplate that was repeated across 6+ per-host
docs. The per-host docs now contain only the host-specific content
(native tools, quirks, integration story). Per principle 5 (lean
body, layered references), the boilerplate lives here so the per-host
docs stay short and host-specific.
