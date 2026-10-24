# Backend: mem0

---

## What this backend is

mem0 (https://mem0.ai) is a memory layer for AI agents. It provides:
- A unified API for adding, searching, updating, and deleting memories
- A managed or self-hosted deployment
- Multi-user support via API keys + user_id
- Built-in embedding generation
- Built-in vector search (semantic + keyword)

**Why mem0:** for organisations that want a cloud memory layer without
managing their own vector DB, mem0 is the de facto choice.

---

## Detection

The agent detects mem0 by:

1. Looking for `MEM0_API_KEY` in the agent's environment.
2. Looking for `~/.config/mem0/` (mem0's CLI config).
3. Asking the user for the API key location.

**API endpoint:** https://api.mem0.ai/v1 (or self-hosted equivalent)

**Source for the API:** mem0's docs (https://docs.mem0.ai).

---

## Install path

The user needs:

1. A mem0 account (free tier available, paid tiers for production).
2. An API key (generated in the mem0 dashboard).
3. The API key stored in the agent's secure credential store.

**The agent's setup:**

1. Verify the API key is reachable (`GET /v1/ping` or similar).
2. Create the user namespace (`POST /v1/users/` with the user's id).
3. Optionally, set up the org structure (`POST /v1/orgs/`, `POST /v1/projects/`).
4. Tell the user where the key is stored (never echo).

**No additional install is required for the user.**

---

## The record transformation

### From AugmentIQ Context Record to mem0 memory

The agent uses mem0's `add` API:

```python
# Pseudo-code
mem0.add(
    messages=[
        {"role": "user", "content": record.content},
        {"role": "system", "content": f"Source: {record.source}, Tags: {record.tags}"}
    ],
    user_id=augmentiq_unit_id,
    agent_id=augmentiq_agent_id,
    metadata={
        "augmentiq_id": record.id,
        "augmentiq_classification": record.classification,
        "augmentiq_retention_until": record.retention_until,
        "augmentiq_pii_patterns": record.pii_patterns,
        "augmentiq_audit_ref": record.audit_ref,
        "augmentiq_source": record.source,
        "augmentiq_timestamp": record.timestamp,
        "augmentiq_provenance": record.provenance,
        "augmentiq_tags": record.tags,
    }
)
```

**Note:** mem0's `add` takes messages (role/content pairs), not arbitrary
data. AugmentIQ's record is wrapped in a user/system message pair, with
the metadata in the metadata field. This is a lossless mapping.

### From mem0 memory to AugmentIQ Context Record

The agent uses mem0's `search` and `get` APIs:

```python
results = mem0.search(
    query=recall_query,
    user_id=augmentiq_unit_id,
    limit=limit,
    filters={
        # AugmentIQ's filters map to mem0's metadata filters
        "augmentiq_classification": {"in": ["confidential", "restricted"]}
    }
)
```

For each result, the agent reconstructs the AugmentIQ Context Record
from the metadata.

---

## Native API operations

| AugmentIQ operation | mem0 API call | Notes |
|---|---|---|
| **Add record** | `POST /v1/memories/` | via `add()` |
| **Update record** | `PUT /v1/memories/{memory_id}/` | for tag changes |
| **Delete record** | `DELETE /v1/memories/{memory_id}/` | for retention enforcement |
| **Search records** | `POST /v1/memories/search/` | semantic + keyword |
| **Get all records** | `GET /v1/memories/` | paginated, for export |
| **Get by id** | `GET /v1/memories/{memory_id}/` | for record detail |
| **Bulk operations** | `POST /v1/memories/batch/` | for ingest batches |

**Source for the API:** mem0's docs (https://docs.mem0.ai).

---

## Multi-user support

mem0 has explicit multi-user support:

- `user_id`: each user's namespace
- `agent_id`: each agent's namespace (for multi-agent setups)
- `org_id`, `project_id`: org-level grouping (optional)

AugmentIQ maps:

- `unit_id` → `user_id`
- `agent_id` → `agent_id`
- Optional `org_id` if the deployment is multi-org

**The user does not need to think about this** — AugmentIQ handles the
mapping. The user just configures `unit_id` and `agent_id` in the
questionnaire.

---

## Pricing tiers

mem0 has free + paid tiers. The relevant limits for AugmentIQ:

| Tier | Memories | Searches / month | Multi-user | Notes |
|---|---|---|---|---|
| Free | 1,000 | 10,000 | No | For individual use |
| Pro | 100,000 | 1,000,000 | Yes (up to 10 users) | For teams |
| Enterprise | Unlimited | Unlimited | Unlimited | For organisations |

**Action item for v0.1:** verify the exact tier limits and pricing on
mem0's pricing page (https://mem0.ai/pricing). The numbers above are
indicative.

---

## Known quirks

### mem0's auto-extraction

By default, mem0 extracts facts from the input messages and stores each
fact as a separate memory. For example, "Jane is the CEO of Acme"
becomes one memory; "Acme is a B2B SaaS company" becomes another.

**For AugmentIQ, this is a problem.** AugmentIQ's records are discrete
units, not extracted facts. The agent must disable mem0's auto-extraction
to preserve 1:1 record-to-memory mapping.

**How to disable:** mem0's `add` API has a `disable_extraction` parameter
(or similar; the exact name varies by version). The agent sets it to
`true` for AugmentIQ records.

**Source for this quirk:** mem0's docs (search for "extraction" or
"memory types").

### Embedding model

mem0 uses OpenAI's `text-embedding-3-small` by default. AugmentIQ does
not control the embedding model — the agent's `recall` queries use
mem0's embeddings, which may not match the agent's native embedding
model.

**Implication:** semantic search quality depends on mem0's embedding
model. If the agent has a different model, the recall results may
differ from what the user expects.

**Mitigation:** AugmentIQ stores `embedding_ref` in the metadata,
pointing to the agent's native embedding (if generated). The agent
can re-rank mem0's results using its own embedding. (v0.1 does not
do this — it's a future enhancement.)

### Memory expiration

mem0 has a `expiration_date` field per memory. AugmentIQ maps
`retention_until` to this field, so mem0 can auto-expire records.

**However:** mem0's auto-expiration is destructive — the memory is
deleted. Per Principle 3 (data is yours, forever), AugmentIQ prefers
to archive rather than delete. The agent uses mem0's `expiration_date`
only when the user's policy is "delete on expiration" (configurable).

### Search latency

mem0's search is cloud-based. Latency is typically 100-500ms per query.
For high-volume recall (e.g., per-message in a chat), this can add up.

**Mitigation:** the agent batches recall queries when possible (e.g.,
when recalling multiple contexts at once).

### Memory ID format

mem0's memory IDs are UUIDs (like AugmentIQ's). No transformation
needed. The agent stores mem0's ID alongside AugmentIQ's ID in the
metadata for traceability.

---

## Self-hosted mem0

The user can self-host mem0 (it's open-source). The setup is the same
as mem0 Cloud, but the API endpoint is different (e.g.,
`http://localhost:8000/v1` for the default Docker setup).

**Source for self-hosted setup:** mem0's GitHub
(https://github.com/mem0ai/mem0).

AugmentIQ detects self-hosted mem0 by:

1. Looking for `MEM0_API_URL` (custom env var).
2. The default URL (https://api.mem0.ai/v1) is the cloud version.

---

## The "mem0 + AugmentIQ" value prop

For the user, the value of using mem0 as the AugmentIQ backend is:

1. **No vector DB to manage.** mem0 handles the embeddings, the search,
   the storage.
2. **Multi-user out of the box.** mem0 has user_ids built in.
3. **Cloud or self-hosted.** Either way, the user doesn't have to write
   the storage layer.
4. **AugmentIQ adds the governance layer** on top — the classification,
   the retention, the audit log, the redaction workflow. mem0 is the
   storage; AugmentIQ is the rules.

**The pricing math:** mem0 Pro at $99/month (assumed) + AugmentIQ (free)
+ the agent's own cost. The user pays for storage and intelligence; the
governance is free.

---

## What this backend does NOT do

- It does not handle the agent's working memory. That's the agent's
  job. AugmentIQ only governs the persistent memory.
- It does not provide a UI for the user. The user interacts with the
  agent, not with mem0 directly. (mem0 has its own dashboard, but
  AugmentIQ doesn't use it.)
- It does not handle the legacy ingest for mem0 as a source. mem0 as a
  *backend* and mem0 as a *source* are different things. (mem0 is not
  listed as a legacy source in `references/ingest/`. If the user
  wants to ingest from mem0, they use `standard_saas` with the mem0
  API.)

---
