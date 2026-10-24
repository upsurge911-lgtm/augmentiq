#!/usr/bin/env bash
# AugmentiQ Obsidian plugin — smoke test against a live instance.
# Usage: TOKEN=<bearer-token> ./smoke.sh [port]    (default port 3710)
#
# Quoting rule for this file: JSON args that embed shell variables are built
# with printf into plain variables BEFORE the check line — never nest \"…\"
# escapes inside $(…) inside "…" (a classic bash trap that splits args).
set -u
PORT="${1:-3710}"
BASE="http://127.0.0.1:${PORT}"
TOKEN="${TOKEN:?set TOKEN=<bearer token>}"
PASS=0
FAIL=0

rpc() { curl -s -m 15 -X POST "$BASE/mcp" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$1"; }
tool() { # tool <name> <json-args> -> inner result text (or <<ERROR>> envelope)
  local name="$1" args="$2" resp
  resp=$(rpc "{\"jsonrpc\":\"2.0\",\"id\":$RANDOM,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}")
  printf '%s' "$resp" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'result' in d:
    sys.stdout.write(d['result']['content'][0]['text'])
else:
    sys.stdout.write('<<ERROR>> ' + json.dumps(d.get('error')))
" 2>/dev/null
}
field() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null; }
check() {
  if [ "$#" -ne 3 ]; then
    echo "  FAIL: $1 — internal: check received $# args (quoting bug in this script)"
    FAIL=$((FAIL+1))
    return
  fi
  local name="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then echo "  PASS: $name"; PASS=$((PASS+1)); else echo "  FAIL: $name — got: '$got' want: '$want'"; FAIL=$((FAIL+1)); fi
}

echo "== AugmentiQ smoke test (port $PORT) =="

# 1. liveness (no auth)
check "health endpoint" "$(curl -s -m 5 "$BASE/health" | field "d['status']")" "ok"

# 2. MCP initialize handshake
check "initialize handshake" "$(rpc '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' | field "d['result']['serverInfo']['name']")" "augmentiq"

# 3. tools/list exposes the 10 tools
check "tools/list count = 10" "$(rpc '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | field "len(d['result']['tools'])")" "10"

# 4. auth enforced without a token
check "auth enforced (401)" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":3,"method":"tools/list"}')" "401"

# 5. memory.health — audit chain verified
H=$(tool memory '{"action":"health"}')
check "memory.health chain ok" "$(printf '%s' "$H" | field "d['chain']['ok']")" "True"

# 6-7. memory.remember + recall
R=$(tool memory '{"action":"remember","content":"AugmentiQ plugin deployed and running on the Robin vault — first memory","type":"observation","tags":["smoke","first"],"importance":4}')
check "memory.remember id prefix" "$(printf '%s' "$R" | field "d['record_id'].startswith('augmentiq:')")" "True"
check "memory.recall finds it" "$(tool memory '{"action":"recall","query":"deployed running first memory"}' | field "d['total'] >= 1")" "True"

# 8-12. contract tools: add, search, audit entry, update, delete (redact)
R=$(tool mcp_add_memory '{"record":{"content":"Contract record via mcp_add_memory — smoke test","tags":["smoke","contract"],"classification":"internal","scope":"individual"}}')
RID_B=$(printf '%s' "$R" | field "d['record_id']")
check "mcp_add_memory status" "$(printf '%s' "$R" | field "d['status']")" "ok"
check "mcp_search_memory finds it" "$(tool mcp_search_memory '{"query":"contract record smoke"}' | field "d['total'] >= 1")" "True"
GA_ARGS=$(printf '{"record_id":"%s"}' "$RID_B")
check "mcp_get_audit_entry hash" "$(tool mcp_get_audit_entry "$GA_ARGS" | field "len(d['audit_hash'])")" "64"
UPD_ARGS=$(printf '{"record_id":"%s","updates":{"tags":["smoke","updated"]}}' "$RID_B")
check "mcp_update_memory" "$(tool mcp_update_memory "$UPD_ARGS" | field "d['status']")" "ok"
check "update persisted (tags=updated)" "$(tool mcp_search_memory '{"query":"contract record","filters":{"tags":["smoke","updated"]}}' | field "d['total'] >= 1")" "True"
R=$(tool mcp_add_memory '{"record":{"content":"Contract record two via mcp_add_memory — redaction target","tags":["smoke","redact"],"classification":"internal"}}')
RID_C=$(printf '%s' "$R" | field "d['record_id']")
DEL_ARGS=$(printf '{"record_id":"%s","delete_type":"redact"}' "$RID_C")
check "mcp_delete_memory redact" "$(tool mcp_delete_memory "$DEL_ARGS" | field "d['status']")" "ok"
SRCH_C=$(printf '{"query":"redaction target","filters":{"tags":["smoke","redact"]}}' "$RID_C")
check "redaction visible in search" "$(tool mcp_search_memory "$SRCH_C" | field "'REDACTED' in d['records'][0]['content']")" "True"

# 13-15. vault round-trip: create, read, append
check "vault.create" "$(tool vault '{"action":"create","path":"AugmentiQ-TEST.md","content":"# AugmentiQ smoke test file"}' | field "d['status']")" "ok"
check "vault.read" "$(tool vault '{"action":"read","path":"AugmentiQ-TEST.md"}' | field "'smoke test file' in d['content']")" "True"
check "edit.append" "$(tool edit '{"action":"append","path":"AugmentiQ-TEST.md","content":"appended line"}' | field "d['status']")" "ok"

# 16. graph on a real vault file
FIRST=$(tool vault '{"action":"list","pageSize":5}' | field "d['files'][0]['path']")
GRAPH_ARGS=$(printf '{"action":"forwardlinks","path":"%s"}' "$FIRST")
check "graph.forwardlinks on $FIRST" "$(tool graph "$GRAPH_ARGS" | field "isinstance(d['forwardlinks'], list)")" "True"

# 17. vault.delete (trash)
check "vault.delete to trash" "$(tool vault '{"action":"delete","path":"AugmentiQ-TEST.md"}' | field "d['status']")" "ok"

# 18. memory.forget with confirm (archive) — persisted this time
FORGET_ARGS=$(printf '{"action":"forget","id":"%s","confirm":true}' "$RID_B")
check "memory.forget (archive)" "$(tool memory "$FORGET_ARGS" | field "d['status']")" "ok"

# 19-20. persistence verified through the store itself
check "forget persisted (archived excluded)" "$(tool mcp_search_memory '{"query":"contract record","filters":{"tags":["smoke","updated"]}}' | field "d['total'] == 0")" "True"
check "final chain ok" "$(tool memory '{"action":"health"}' | field "d['chain']['ok']")" "True"

echo
echo "== RESULT: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]