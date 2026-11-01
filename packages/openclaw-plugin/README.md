# AugmentiQ for OpenClaw

Persistent memory for your OpenClaw agent, stored as plain Markdown in your Obsidian vault.

Adds six native tools that proxy to the AugmentiQ Obsidian plugin's embedded MCP server. Your agent stops starting every session from zero: it recalls what it learned, records what it discovers, and every write lands in a hash-chained audit log you can verify.

Everything runs on your machine. The server binds `127.0.0.1` only — no cloud, no telemetry.

## Install

**1. The vault (required).** Install the **AugmentiQ** plugin in Obsidian, enable it, and copy the bearer token from the ribbon icon. The status bar should read `AugmentiQ:3710`.

**2. This plugin.**

```bash
openclaw plugins install clawhub:upsurge/augmentiq
openclaw config set plugins.entries.augmentiq.config.token "<paste your token>"
```

The token must be a **literal string** — SecretRefs do not resolve for plugin config objects.

**3. The skill (recommended).** The plugin gives your agent tools; the skill gives it judgement about when to use them.

```bash
openclaw skills install augmentiq
```

## Tools

| Tool | Use it for |
|---|---|
| `augmentiq_memory` | `recall` · `remember` · `forget` · `health` · `profile` · `consolidate` |
| `mcp_add_memory` | Write a canonical AugmentiQ Context Record |
| `mcp_search_memory` | Search records, or the audit timeline via `filters.action` |
| `mcp_update_memory` | Re-tag, reclassify, redact, set retention |
| `mcp_delete_memory` | `redact` · `destroy` · `erasure` |
| `mcp_get_audit_entry` | Read back the hash-chained audit entry for a record |

## Configuration

| Setting | What it does | Default |
|---|---|---|
| `token` | Bearer token for the AugmentiQ server | required |
| `baseUrl` | MCP endpoint | `http://127.0.0.1:3710/mcp` |

## Troubleshooting

| Symptom | Fix |
|---|---|
| "not configured" | Set `plugins.entries.augmentiq.config.token` |
| 401 | Token regenerated in Obsidian — copy the new one |
| "server unreachable" | Open Obsidian; check the status bar shows `AugmentiQ:3710` |

## Development

```bash
npm install
npm run plugin:build     # tsc + openclaw plugins build
npm run plugin:validate
npm test
```

Source: [github.com/upsurge911-lgtm/augmentiq](https://github.com/upsurge911-lgtm/augmentiq)

## License

MIT. Commercial deployments, compliance packs and the enterprise backend: customdev@upsurge.ae
