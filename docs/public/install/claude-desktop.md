# Install AugmentIQ on Claude Desktop

**Status:** DRAFT v0.1 — Claude Desktop UI paths below are from 2026 third-party guides; verify against claude.com/docs during Phase 1 before publishing.

## 1. Install the skill

Claude Desktop → Settings → Customize → Skills → **+** → upload a **ZIP of this repo** (with `SKILL.md` at the ZIP root, including `references/` and `assets/`). Claude reads the `SKILL.md` and enables it.

## 2. Backend MCP (optional — for the AugmentIQ+ backend)

Claude Desktop supports local MCP servers via the developer config (`claude_desktop_config.json`). Point an `mcpServers` entry at the AugmentIQ+ Docker launch:

```json
{
  "mcpServers": {
    "augmentiq": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "augmentiq-engine"]
    }
  }
}
```

(Exact entry verified during Phase 1; see repo `references/mcp-integration.md` for the contract.)

## 3. Verify

Ask Claude: "run /augmentiq help"