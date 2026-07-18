# Legacy Ingest: Strategy Decision Tree

---

## What this document does

When the user declares a legacy source, AugmentIQ must pick a strategy. The
choice affects:
- How long the migration takes
- Whether the user has to stay in-session
- Whether the migration is one atomic event or a series of nightly batches
- Whether customdev@upsurge.ae gets involved

This document specifies the rule.

---

## The decision tree

```
IF source.source_category == "enterprise_platform":
    → strategy = "paused" (route to customdev@upsurge.ae)
    → user confirms: "Add this to your pending_migration list?"

ELIF source.volume_gb <= 1 AND source.item_count <= 10000:
    → strategy = "one_shot"
    → message: "We'll transfer everything in one session. ~<estimated_minutes> minutes."
    → ask: "Proceed now, or schedule for tonight?"

ELIF source.volume_gb <= 500 AND source.item_count <= 1000000:
    → strategy = "nightly_batches"
    → batch_size = derived from volume_gb (see below)
    → message: "We'll transfer in nightly batches of <batch_size> items, one batch per night at 2am."
    → message: "Estimated <N> nights. Completion by <estimated_completion_date>."
    → ask: "Confirm nightly schedule, or adjust batch size?"

ELSE (volume_gb > 500 OR item_count > 1000000):
    → strategy = "paused"
    → message: "This is enterprise-scale. We recommend a paid migration engagement."
    → message: "Expected: 2-6 weeks. Cost: $25k-$80k."
    → ask: "Pause here, or contact customdev@upsurge.ae for a quote?"
```

---

## Batch size derivation

For `nightly_batches` strategy, the batch size is auto-recommended based on
volume:

| Volume (GB) | Default batch size | Rationale |
|---|---|---|
| ≤ 5 | `small_100` (100 items/night) | Low volume, conservative default |
| ≤ 50 | `medium_1000` (1,000 items/night) | Standard nightly batch |
| ≤ 250 | `large_10000` (10,000 items/night) | Aggressive but safe |
| ≤ 500 | `xl_100000` (100,000 items/night) | Maximum nightly batch |

**The user can override** the batch size via the questionnaire or
`/augmentiq reconfigure`. Smaller batches = more nights, less impact on
the source system. Larger batches = fewer nights, more load on the source.

**The user can also override the schedule** (e.g., "run every 6 hours instead
of nightly" or "only on weekends"). The cron registration accommodates
custom schedules.

---

## Estimated nights for nightly_batches

```
estimated_nights = ceil(items_per_batch / legacy_batch_size_items)

Where:
  items_per_batch = batch_size value (e.g., 1000 for medium_1000)
  legacy_batch_size_items = the user's chosen batch size
```

**Example:** 50GB SharePoint with 200,000 items, default batch = large_10000:
- `estimated_nights = ceil(200000 / 10000) = 20 nights`
- At 6 hours per night, the total wall-clock is ~120 hours of processing
  spread over 20 calendar days.

---

## The "schedule for tonight" option (one_shot)

For `one_shot` strategy, the user can:
- **Proceed now:** the agent runs the migration immediately, in the current
  session. The user can monitor progress, pause, cancel.
- **Schedule for tonight:** the agent defers to the next `daily-snapshot`
  cron window (2am), runs the migration then. The user is alerted when it
  completes.

**Default:** "Proceed now" is the default. The user can press Enter to accept.

---

## The "pause and route" flow (enterprise_platform)

For `enterprise_platform` source_category, the user is offered:

1. **Add to pending_migration list** — the source is added to
   `legacy_sources[]` with `ingest_status = pending_migration` and
   `routed_to = customdev@upsurge.ae`. The user is shown a draft email.
2. **Open the email draft in their agent** — the agent uses its native email
   capability to compose and (with confirmation) send the draft.
3. **Skip for now** — the source is not added. The user can revisit via
   `/augmentiq ingest`.

**Default:** "Add to pending_migration list" is the default. The user can
press Enter to accept.

---

## State transitions

The `ingest_status` field moves through these states:

```
declared → assessing → estimated → confirmed → scheduled → in_progress
                                                              ↓
                              completed ← (items_remaining == 0)
                              ↓
                              paused (user paused, can resume)
                              ↓
                              failed (auth or rate-limit, can retry or skip)
                              ↓
                              cancelled (user cancelled, can't resume)
```

**Transitions are logged to the timeline** with the old_status → new_status
and the trigger (user, cron, error).

---

## What the strategy decision tree does NOT do

- It does not start the migration. The user must confirm with
  `/augmentiq ingest` after seeing the strategy recommendation.
- It does not handle authentication. The user must have already set up the
  auth method.
- It does not pre-flight the target backend. The target must be reachable
  before the migration starts.

---
