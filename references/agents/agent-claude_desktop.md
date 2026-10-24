# Agent: Claude Desktop

> **Status:** per-host reference (Tier 2). Detection, install path,
> cron format, and slash command convention are in `agent-_common.md`.
> This doc contains only the host-specific content for Claude Desktop,
> plus the integration story.

## What Claude Desktop is

Claude Desktop is Anthropic's consumer desktop app (macOS / Windows).
It loads Agent Skills via the built-in Skills manager and local MCP
servers via the developer config. It is a conversational host: it has
no terminal, no arbitrary filesystem access, and no code execution on
the host side.

**Source for Claude Desktop:** Anthropic's public documentation
(claude.com/docs). Verify the exact UI labels against the docs for the
version the user runs — the Skills manager UI has moved between
"Settings → Skills" and "Customize → Skills" across releases.

## Detection, install, cron, slash command

See `agent-_common.md` for the common pattern. Claude Desktop specifics:
- **Marker:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
- **Skill path:** none on disk — skills are uploaded as a **ZIP** through the app (Settings → Customize → Skills → **+**; `SKILL.md` at the ZIP root, include `references/` and `assets/`). Re-upload on every skill update.
- **Cron:** none native. The 6 cadences run **manually** (user asks) or via an OS-level scheduler pointed at the AugmentIQ+ container (v0.1: manual).
- **Slash commands:** none. The 26 commands map to natural language ("run augmentiq init", "save this: …", "show the audit timeline").

## Native tool set (relevant to AugmentIQ)

Claude Desktop provides: chat, file attach/download in conversation,
MCP servers (stdio, via `claude_desktop_config.json`), built-in web
search. It does **not** provide: terminal, arbitrary filesystem access,
subagents, or host-side code execution.

The AugmentIQ+ MCP server provides the storage + compute layer
(hybrid search, embeddings, tamper-evident audit), so the lack of
host-side tools is not a blocker — see the integration story below.

## Known constraints

- **No terminal / no filesystem.** Secondary backends that require
  host file operations (writing to an Obsidian vault, ReMe git
  commits, Hermes native files) do **not** work on Claude Desktop
  unless a filesystem MCP connector is configured. The Custom
  (AugmentIQ+) backend is the practical default on this host.
- **Config file edits** are manual (no UI for stdio MCP entries on
  all versions) — the Skill's init flow gives the user the exact JSON
  to paste.
- **Skill updates** require re-uploading the ZIP.
- **No crons** — cadence commands (`daily-snapshot`, etc.) run when
  the user asks; the quarterly audit can be triggered any time.

## File system markers

```
~/Library/Application Support/Claude/          # macOS
  claude_desktop_config.json                   # MCP server config (the AugmentIQ+ entry lives here)
  ...                                          # skills live in an app-managed store, not user-visible
```

## The "Claude Desktop + AugmentIQ" integration story

1. **Claude Desktop is the console.** The user governs memory
   conversationally — init, capture, recall, audit — with zero
   terminal use.
2. **AugmentIQ+ is the memory.** Launched by the Desktop app as a
   stdio MCP server (`docker run -i augmentiq-engine` via
   `claude_desktop_config.json`, or via
   `assets/mcp-launch/claude_desktop.sh`). All storage, search, and
   the audit chain live in the container.
3. **The user gets compliance-grade memory without a terminal.**

**AugmentIQ does not replace Claude.** It augments it.

## Compatibility

| AugmentIQ feature | Claude Desktop support | Notes |
|---|---|---|
| Install as a skill | ✅ | ZIP upload via the Skills manager |
| MCP backend (AugmentIQ+) | ✅ | `claude_desktop_config.json` stdio entry |
| Cron scheduling | ❌ | Manual runs in v0.1 |
| Slash commands | ⚠️ | Conversational invocation instead |
| Read/write host files | ❌ | Via MCP only; Custom backend owns storage |
| Terminal access | ❌ | Not a coding host |
| Subagents | ❌ | — |
| Host-side code execution | ❌ | Server-side (in the container) only |
| Embedding generation | ✅ | Server-side (AugmentIQ+) |
| Web search | ✅ | Built-in |

**v0.1 verdict:** supported as a Tier 2 host via the Custom (AugmentIQ+) backend. Secondary backends are impractical without a filesystem connector.

## Sources
- Anthropic documentation: claude.com/docs (Skills in Claude Desktop; MCP configuration)
- The Agent Skills spec: https://agentskills.io/specification
- `references/mcp-integration.md` for the 5-tool contract and launch sequence