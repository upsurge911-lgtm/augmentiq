# Install on OpenClaw

OpenClaw is the host. AugmentiQ gives it persistent memory plus a policy layer.

**Time:** about two minutes. **You need:** Obsidian desktop running, and the AugmentiQ plugin enabled.

---

## 1. The vault

Obsidian → Settings → Community plugins → **AugmentiQ** → Enable.

The status bar should read `AugmentiQ:3710`. If it reads `✕`, the port is busy — change it in plugin settings and use the new port everywhere below.

Copy the bearer token: click the brain ribbon icon, or Settings → AugmentiQ → **Copy token**.

Verify the server is up:

```bash
curl -s http://127.0.0.1:3710/health
# {"status":"ok","server":"augmentiq","vault":"<your vault>"}
```

## 2. The plugin

```bash
openclaw plugins install clawhub:upsurge/augmentiq
```

Then set the token in the Gateway config:

```bash
openclaw config set plugins.entries.augmentiq.config.token "<paste the token>"
```

**It must be a literal string.** SecretRefs resolve for model and provider config, not for plugin `config` objects — a reference here fails validation with `must be string`.

Confirm the tools loaded:

```bash
openclaw plugins inspect augmentiq --runtime
# Tools: augmentiq_memory, mcp_add_memory, mcp_search_memory,
#        mcp_update_memory, mcp_delete_memory, mcp_get_audit_entry
```

## 3. The skill

```bash
openclaw skills install augmentiq
```

Or, from a clone: `cp -r augmentiq/ ~/.openclaw/workspace/skills/augmentiq/`

The skill is what makes the agent use memory well — it encodes when to recall, what to record, and what never to record.

## 4. First run

Ask your agent:

> Recall anything you already know about me, then remember that this is our first AugmentiQ session.

Expected: a recall call (empty or near-empty on a fresh store), a `remember` call returning a record id, and a second recall that finds it.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Tools return "not configured" | No token in plugin config | `openclaw config set plugins.entries.augmentiq.config.token "<token>"` |
| Tools return 401 | Token regenerated in Obsidian | Copy the new token, set it again |
| "Server unreachable" | Obsidian closed or plugin disabled | Open Obsidian; check the status bar |
| Tools missing from runtime | Plugin installed but not enabled | `openclaw plugins enable augmentiq` |
| Install refuses a local path | Unreviewed source | `--force` — only for a source you built yourself |

## What you get

| Tool | Use it for |
|---|---|
| `augmentiq_memory` | `recall` / `remember` / `forget` / `health` / `profile` / `consolidate` — the daily loop |
| `mcp_add_memory` | Write a canonical Context Record (governance flows) |
| `mcp_search_memory` | Search records, or the audit timeline via `filters.action` |
| `mcp_update_memory` | Re-tag, reclassify, redact, set retention |
| `mcp_delete_memory` | `redact` / `destroy` / `erasure` |
| `mcp_get_audit_entry` | Read back the hash-chained audit entry for a record |
