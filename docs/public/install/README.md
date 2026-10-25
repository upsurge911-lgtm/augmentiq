# Install guides

One page per host, tested against the actual working configuration.

| Host | Guide | What it covers |
|---|---|---|
| **OpenClaw** | [openclaw.md](./openclaw.md) | Plugin install, token in Gateway config, skill install, first run |
| **Hermes** | [hermes.md](./hermes.md) | Folder copy into `~/.hermes/skills/`, MCP server entry, `/augmentiq` commands |
| **Claude Desktop** | [claude-desktop.md](./claude-desktop.md) | Skill ZIP upload, `claude_desktop_config.json` via mcp-remote, conversational invocation |
| **Claude Code** | [claude-code.md](./claude-code.md) | Project and personal skill paths, MCP registration |
| **Any MCP client** | [any-mcp-client.md](./any-mcp-client.md) | Raw endpoint, auth header, tool list |

## The shape of every guide

1. **The vault** — enable the plugin, copy the token, verify with `curl`
2. **The host** — install the plugin or the skill, or point the client at the endpoint
3. **First run** — one command that proves it works
4. **Troubleshooting** — only failures that actually happen

## Two facts worth knowing before you start

**The server lives inside Obsidian.** If Obsidian is closed, memory is unavailable. The status bar reads `AugmentiQ:3710` when it is up and `✕` when it failed to bind.

**The token is a literal string in host config.** OpenClaw plugin config does not resolve SecretRefs — a reference there fails validation with `must be string`. Copy the token from the Obsidian plugin settings each time it is regenerated.

## Prerequisites, once, for every host

- Obsidian **desktop** (the plugin is `isDesktopOnly`)
- The AugmentiQ plugin installed and enabled, with the server running on `127.0.0.1:3710`
- One supported agent host

No Docker. No daemon. No cloud account.
