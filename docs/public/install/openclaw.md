# Install AugmentIQ on OpenClaw

**Status:** DRAFT v0.1

## 1. Install the skill

Copy this repo's skill package into your agent's workspace skills directory:

```bash
git clone https://github.com/upsurge911-lgtm/AugmentIQ.git
cp -r AugmentIQ/ ~/.openclaw/workspace/skills/augmentiq/
```

After public launch this becomes one command: `openclaw skills install augmentiq` (ClawHub).

## 2. Pick a memory backend

- **Obsidian** — you have a vault. Skill governs the vault files.
- **Hermes native** — you live in `MEMORY.md` + `USER.md`.
- **mem0 / ReMe** — you already use them.
- **AugmentIQ+** (recommended for serious use) — Docker MCP server, launch via `assets/mcp-launch/openclaw.sh`.

Configure with `/augmentiq init` and answer the questionnaire.

## 3. Verify

In a chat with your agent, run: `/augmentiq help`