# Install on Claude Code

Claude Code reads skills from a personal directory or a project directory, and registers MCP servers with `claude mcp add`.

**Time:** two minutes. **You need:** Obsidian desktop running, and the AugmentiQ plugin enabled.

---

## 1. The vault

Obsidian → Settings → Community plugins → **AugmentiQ** → Enable.

Status bar should read `AugmentiQ:3710`. Copy the bearer token from the ribbon icon.

```bash
curl -s http://127.0.0.1:3710/health
```

## 2. The skill

Personal (available in every project):

```bash
git clone https://github.com/upsurge911-lgtm/augmentiq.git
cp -r augmentiq/ ~/.claude/skills/augmentiq/
```

Or per project:

```bash
cp -r augmentiq/ .claude/skills/augmentiq/
```

`SKILL.md` must sit at the root of that folder.

## 3. Connect it to the vault

```bash
claude mcp add --transport http augmentiq http://127.0.0.1:3710/mcp \
  --header "Authorization: Bearer <your-token>"
```

Verify with `claude mcp list` — `augmentiq` should appear with a connected status.

## 4. First run

```
/augmentiq status
```

Then:

```
/augmentiq save "First AugmentiQ memory from Claude Code"
/augmentiq recall "first AugmentiQ memory"
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Skill not loaded | Wrong folder depth | Path must be `…/skills/augmentiq/SKILL.md` |
| `claude mcp add` rejects the transport | Older CLI | Run `claude mcp add-json augmentiq '{"type":"http","url":…,"headers":{…}}'` |
| 401 | Token stale | Re-copy from Obsidian settings |
| Tools listed but calls fail | Obsidian closed | Open Obsidian; check status bar |
