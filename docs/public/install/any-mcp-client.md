# Any other MCP client or host agent

**Status:** DRAFT v0.1

AugmentIQ follows the open [Agent Skills standard](https://agentskills.io) — it works on 30+ spec-compliant hosts.

## If your host supports skills

Copy this repo's package (folder `augmentiq/` containing `SKILL.md`, `references/`, `assets/`) into your host's skills directory.

## If your host supports MCP but not skills

Wire the AugmentIQ+ MCP server as a backend (see `references/mcp-integration.md` for the 5-tool contract and launch procedure) and use `references/commands.md` as the operating manual for the 26 commands.

## If your host supports neither

The `references/` folder is plain Markdown — it can serve as a manual operating procedure for any agent with file access.