# Legacy Ingest: Batch Protocol

---

## What this document does

Every batch a legacy ingest produces must be logged. The log entry has a
specific shape so that:
- Auditors can see what happened
- Users can debug failures
- The compliance packs can report per-batch stats
- The AugmentIQ timeline stays structured and queryable

This document specifies the shape.

---

## The batch log entry

Every batch produces **one timeline entry** with the following shape:

```json
{
  "action": "ingest_batch",
  "actor": "<owner_name>",
  "batch_id": "ingest-<source_id>-<YYYY-MM-DDTHH-MM-SSZ>",
  "source_id": "<the legacy source id>",
  "source_type": "<the source type>",
  "source_category": "<local_files|cloud_storage|standard_saas|email|enterprise_platform>",
  "batch_started_at": "<ISO 8601 timestamp>",
  "batch_completed_at": "<ISO 8601 timestamp>",
  "duration_seconds": <integer>,
  "items_attempted": <integer>,
  "items_succeeded": <integer>,
  "items_failed": <integer>,
  "items_skipped": <integer>,
  "classification_breakdown": {
    "public": <integer>,
    "internal": <integer>,
    "confidential": <integer>,
    "restricted": <integer>
  },
  "pii_patterns_detected": {
    "email": <integer>,
    "phone": <integer>,
    "ssn": <integer>,
    "credit_card": <integer>,
    "bank_account": <integer>,
    "ip_address": <integer>,
    "physical_address": <integer>,
    "other": <integer>
  },
  "failures": [
    {
      "item_id": "<source system identifier>",
      "error_code": "<short code>",
      "error_message": "<human-readable error>"
    }
  ],
  "user_confirmed": <true|false>
}
```

**The entry is JSON, written to the AugmentIQ timeline, queryable via
`/augmentiq timeline --filter=ingest_batch --source=<source_id>`.**

---

## What the agent must log per batch

1. **`batch_id`** — unique per batch. Format: `ingest-<source_id>-<ISO timestamp>`.
   Used as the foreign key for `/augmentiq ingest retry <batch_id>`,
   `/augmentiq ingest skip <batch_id>`.
2. **`batch_started_at`** / **`batch_completed_at`** — for the audit log
   (compliance requires timing data).
3. **`duration_seconds`** — for the per-source performance metrics.
4. **`items_attempted`** — what the agent tried to process.
5. **`items_succeeded`** — what made it to the memory backend.
6. **`items_failed`** — what couldn't make it. Paired with `failures[]` detail.
7. **`items_skipped`** — what the user explicitly skipped via
   `/augmentiq ingest skip <batch_id>`. Not the same as `failed`.
8. **`classification_breakdown`** — for compliance reporting. How many
   records landed in each classification.
9. **`pii_patterns_detected`** — for the PII auto-upgrade audit. Counts of
   PII patterns found, never the actual PII values.
10. **`user_confirmed`** — was the user confirmed this batch in-session?
    If false, the batch was auto-run (low-volume batches <100 items,
    per the cron contract).

---

## The failures list

Each failed item gets an entry in `failures[]`. The structure is minimal —
just enough to debug, not enough to leak content if the audit log is shared.

```json
{
  "item_id": "salesforce_opportunity:5678",
  "error_code": "RATE_LIMITED",
  "error_message": "API rate limit hit. Retry after 60s."
}
```

**Error codes are constrained to a small enum:**

| Code | Meaning | Action |
|---|---|---|
| `RATE_LIMITED` | API rate limit hit | Auto-retry on next batch |
| `AUTH_FAILED` | Credentials expired or invalid | Pause source, alert user |
| `NOT_FOUND` | Item no longer exists in source | Log, continue (don't fail batch) |
| `SCHEMA_ERROR` | Item format not parseable | Log, continue |
| `TIMEOUT` | Item fetch timed out | Auto-retry on next batch |
| `DISK_FULL` | Memory backend out of space | Pause source, alert user |
| `INVALID_CONTENT` | Content fails sanitisation | Log, continue |
| `OTHER` | Unclassified error | Log, alert user |

**Source-specific error codes** can be added by the per-category directive
(`references/ingest/sources/<category>.md`).

---

## State updates after each batch

After a batch completes, the agent updates the source's state in
`legacy_sources[]`:

```json
{
  "source_id": "local-files-marketing",
  "items_processed": 1235,        // cumulative across all batches
  "items_remaining": 7165,         // initial - processed - skipped
  "last_batch_timestamp": "2026-07-16T02:14:00Z",
  "next_batch_timestamp": "2026-07-17T02:00:00Z",  // for nightly_batches
  "estimated_completion_date": "2026-07-19",
  "ingest_status": "in_progress"   // or "completed" if items_remaining == 0
}
```

The `ingest_status` transitions:
- `in_progress` → `completed` when `items_remaining == 0`
- `in_progress` → `paused` on `/augmentiq ingest pause`
- `in_progress` → `cancelled` on `/augmentiq ingest cancel`
- `in_progress` → `failed` on 3 consecutive batch failures
- `failed` → `in_progress` on `/augmentiq ingest retry <batch_id>` (resolves the failure)

---

## Failure handling

### Single batch fails

- Items in the failed batch are marked `failed` in the timeline.
- The next batch is allowed to proceed (no automatic pause).
- The next batch's log includes the previous batch's `batch_id` as a
  reference, so the user can see the relationship.

### 3 consecutive batches fail

- The source is marked `failed` in `ingest_status`.
- The `ingest-batch` cron is disabled for that source.
- The user is alerted immediately (in-session if active, queued if not).
- The user can `/augmentiq ingest retry <batch_id>` to recover the latest
  failure, or `/augmentiq ingest skip <batch_id>` to skip it.

### Auth failure (any batch)

- The source is marked `auth_failed` (a sub-status of `failed`).
- The `ingest-batch` cron is disabled.
- The user is alerted with a specific message: "Your <source> auth has
  expired. Update credentials and run /augmentiq ingest retry."

### Source data corruption

- The batch is marked `failed` with `error_code: SCHEMA_ERROR` for the
  affected items.
- Items that parsed successfully are still written.
- The user can review the failed items and `/augmentiq ingest skip` the
  problematic ones.

---

## Validation before marking batch complete

Before logging a batch as `success`, the agent must verify:

1. The batch log entry was written to the timeline.
2. The state updates were applied to `legacy_sources[]`.
3. The classification breakdown was computed (sum of
   `classification_breakdown.{public,internal,confidential,restricted}`
   should equal `items_succeeded`).
4. The PII patterns count was computed (sum of `pii_patterns_detected`
   should be ≥ 0, not necessarily equal to anything else).

**If any check fails:**
- Log the batch as `failed` with `error_code: VALIDATION_FAILED`.
- Surface to the user.
- Do not advance the source's `items_processed` or `items_remaining`.

---

## The on-disk representation

The timeline (where batch log entries live) is stored in the memory backend
per `references/timeline-schema.md`. The legacy source state lives in
`~/.augmentiq/config.yaml` under `legacy.legacy_sources[]`.

**A batch log entry is ~500 bytes. A typical 1-year migration produces
~100 batches. Total batch log footprint: ~50 KB. Negligible.**

---

## What the batch protocol does NOT do

- It does not retry individual items within a batch. Items that fail are
  marked failed; the next batch picks up from where this one left off.
- It does not aggregate batches. Each batch is its own timeline entry.
  Aggregated views come from `/augmentiq ingest report`.
- It does not cross-reference batches to records. A record's `audit_ref`
  points to the timeline entry that created it; that's the record's link
  to its batch.

---
