# Install AugmentIQ on Claude Code

**Status:** DRAFT v0.1 — verify the exact `claude mcp add` syntax during Phase 1.

## 1. Install the skill

```bash
cp -r AugmentIQ/ ~/.claude/skills/augmentiq/     # personal (all projects)
# or
cp -r AugmentIQ/ .claude/skills/augmentiq/       # a single project
```

## 2. Backend MCP (optional — for the AugmentIQ+ backend)

```bash
claude mcp add augmentiq -- /path/to/repo/assets/mcp-launch/claude_code.sh
```

## 3. Verify

```
/augmentiq help
```