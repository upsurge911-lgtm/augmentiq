# Install on Claude Desktop

Claude Desktop loads skills by ZIP upload and connects to MCP servers through its config file.

**Time:** three minutes. **You need:** Obsidian desktop running, and the AugmentiQ plugin enabled.

---

## 1. The vault

Obsidian → Settings → Community plugins → **AugmentiQ** → Enable.

Status bar should read `AugmentiQ:3710`. Copy the bearer token from the ribbon icon.

Verify:

```bash
curl -s http://127.0.0.1:3710/health
```

## 2. The skill

Claude Desktop → Settings → **Customize** → **Skills** → **+** → upload a ZIP of the skill package.

The ZIP must have `SKILL.md` at its root. To build it:

```bash
git clone https://github.com/upsurge911-lgtm/augmentiq.git
cd augmentiq
zip -r augmentiq-skill.zip SKILL.md references assets README.md LICENSE
```

Upload `augmentiq-skill.zip`.

> UI labels have moved between Claude Desktop releases. If **Customize → Skills** isn't where it is on your build, look under Settings → Capabilities, or search the settings for "Skills".

## 3. Connect it to the vault

Claude Desktop reads local MCP servers from `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "augmentiq": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "http://127.0.0.1:3710/mcp",
        "--header", "Authorization: Bearer <your-token>"
      ]
    }
  }
}
```

Restart Claude Desktop completely — quit from the menu, not just close the window.

## 4. First run

Ask Claude:

> Use the augmentiq memory tool with action health, and tell me what the audit chain says.

Expected: a health report with a record count and `chain.ok: true`.

Then:

> Remember that this is our first AugmentiQ session, then recall it.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Skill not in the list after upload | ZIP lacks `SKILL.md` at root | Rebuild the ZIP from the repo root |
| Tools unavailable | Config JSON malformed | Validate the file; a trailing comma breaks it |
| "command not found: npx" | Node not on PATH for GUI apps | Use the absolute path to npx, or install Node via the official installer |
| 401 | Token stale | Copy a fresh token and update the config |

## What to expect on this host

Claude Desktop is conversational — there are no slash commands. The 26 skill commands map to plain requests ("save this", "what do you know about me", "show the audit timeline"). Cron cadences don't run on their own; you trigger snapshots and consolidation by asking.
