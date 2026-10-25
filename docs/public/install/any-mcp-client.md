# Any MCP client or host agent

AugmentiQ is a standard MCP server over streamable HTTP. Anything that speaks MCP can use it — you do not need a dedicated plugin.

**You need:** Obsidian desktop running with the AugmentiQ plugin enabled.

---

## The endpoint

```
POST http://127.0.0.1:3710/mcp
Authorization: Bearer <token from Obsidian plugin settings>
Content-Type: application/json
```

The server is **stateless**: each request is independent, so no handshake state is required between calls. `initialize`, `tools/list` and `tools/call` all work on a fresh connection.

Liveness check, no auth required:

```bash
curl -s http://127.0.0.1:3710/health
# {"status":"ok","server":"augmentiq","vault":"<vault name>"}
```

## A complete call

```bash
curl -s -X POST http://127.0.0.1:3710/mcp \
  -H "Authorization: Bearer $AUGMENTIQ_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "memory",
      "arguments": { "action": "health" }
    }
  }'
```

The reply wraps the payload as text in `result.content[0].text`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"total\":14,\"active\":1,\"archived\":13,\"chain\":{\"ok\":true,\"checked\":33}}"
    }]
  }
}
```

Parse that inner string as JSON to get the tool's result.

## Tools

| Tool | Actions |
|---|---|
| `memory` | `recall`, `remember`, `forget`, `health`, `profile`, `consolidate` |
| `vault` | `list`, `read`, `create`, `update`, `delete`, `search`, `move`, `rename`, `copy` |
| `edit` | `append`, `window`, `patch` |
| `graph` | `forwardlinks`, `backlinks`, `neighbors`, `traverse`, `path` |
| `system` | `info`, `commands` |
| `mcp_add_memory` | Write a canonical Context Record |
| `mcp_search_memory` | Search records, or the timeline via `filters.action` |
| `mcp_update_memory` | Re-tag, reclassify, redact, set retention |
| `mcp_delete_memory` | `redact`, `destroy`, `erasure` |
| `mcp_get_audit_entry` | Read back a record's audit entry |

Schemas: `tools/list` returns the full input schema for each.

## Error codes

JSON-RPC 2.0, plus AugmentiQ-specific codes:

| Code | Meaning |
|---|---|
| `-32700` | Parse error — malformed JSON |
| `-32601` | Unknown tool or method |
| `-32602` | Invalid params — a required field was missing or the wrong type |
| `-32001` | Record or file not found |
| `-32002` | Permission denied — read-only mode, or bad bearer token |
| `-32003` | Audit chain broken — treat as a data-integrity alert |

## Without a skill

The skill supplies judgement about *when* to remember. Without it, you can still drive the tools directly — the most useful subset is:

```json
{"action": "recall", "query": "<current task>", "limit": 10}
{"action": "remember", "content": "<what was learned>", "type": "observation", "tags": ["..."], "importance": 3}
{"action": "health"}
{"action": "consolidate"}
```

Recording three to five meaningful items per session, and running `consolidate` weekly, is the whole discipline.
