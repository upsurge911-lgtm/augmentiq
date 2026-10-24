# Install AugmentIQ on Hermes

**Status:** DRAFT v0.1 — install path verified against official Hermes docs (skills live in `~/.hermes/skills/`, agentskills.io-compatible).

## 1. Install the skill

```bash
cp -r AugmentIQ/ ~/.hermes/skills/augmentiq/
hermes skills reload
```

## 2. Pick a memory backend

- **Hermes native** (`MEMORY.md` + `USER.md`) — default for the individual tier.
- **AugmentIQ+** (recommended for organisation / department tiers) — launch via `assets/mcp-launch/hermes.sh`.

Configure with `/augmentiq init` and answer the questionnaire.

## 3. Verify

```
/augmentiq help
```