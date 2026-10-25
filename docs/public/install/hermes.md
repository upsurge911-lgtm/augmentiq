# Install on Hermes

Hermes reads skills from `~/.hermes/skills/` and follows the agentskills.io standard, so installation is a folder copy.

**Time:** one minute. **You need:** Obsidian desktop running, and the AugmentiQ plugin enabled.

---

## 1. The vault

Obsidian → Settings → Community plugins → **AugmentiQ** → Enable.

Status bar should read `AugmentiQ:3710`. Copy the bearer token from the ribbon icon.

Verify:

```bash
curl -s http://127.0.0.1:3710/health
```

## 2. The skill

```bash
git clone https://github.com/upsurge911-lgtm/augmentiq.git
cp -r augmentiq/ ~/.hermes/skills/augmentiq/
hermes skills reload
```

The folder must contain `SKILL.md` at its root — that is what Hermes reads.

## 3. Connect it to the vault

Hermes needs to know where the memory lives. Add the MCP server to your Hermes config:

```yaml
mcp_servers:
  augmentiq:
    url: http://127.0.0.1:3710/mcp
    headers:
      Authorization: "Bearer <your-token>"
```

Restart the Hermes session so the tools load.

## 4. First run

```
/augmentiq help
/augmentiq status
```

`status` should report the backend as the Obsidian plugin with a live server and a verified audit chain.

Then the real test:

```
/augmentiq save "This is the first AugmentiQ memory on Hermes"
/augmentiq recall "first AugmentiQ memory"
```

The second command should return the first.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `hermes skills reload` doesn't list augmentiq | `SKILL.md` not at folder root | The path must be `~/.hermes/skills/augmentiq/SKILL.md` |
| Commands recognised, tools fail | MCP server unreachable | Check Obsidian is running and `/health` responds |
| 401 on every call | Token stale | Copy a fresh token from Obsidian settings |

## Notes for Hermes users

Hermes has its own native memory in `MEMORY.md` and `USER.md`. AugmentiQ is a different layer: Hermes native memory is character-capped and curated by you; AugmentiQ is unbounded, classified, and audited. They coexist — tell the skill which backend you mean with `/augmentiq reconfigure` if you want to switch.
