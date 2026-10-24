# Legacy Ingest: Estimator

---

## What the estimator does

When the user declares a legacy data source, AugmentIQ needs to tell them:

1. **How long will it take** to ingest?
2. **When will it be done** (estimated completion date)?
3. **What strategy fits** (one_shot, nightly_batches, paused)?
4. **What batch size fits** (small, medium, large, xl)?

The estimator answers all four from the user's two inputs: `volume_gb` and
`item_count`. The math is deliberately simple and conservative — better to
over-estimate time than to miss a deadline and lose user trust.

---

## The formula

```
estimated_transfer_time_hours = (
    volume_hours
    + item_hours
    + transformation_overhead_hours
) / parallelism_factor

Where:
  volume_hours = volume_gb * volume_per_hour_coefficient[source_category]
  item_hours = item_count * item_per_hour_coefficient[source_category]
  transformation_overhead_hours = (
      0.05 * volume_gb   # parsing overhead
      + 0.001 * item_count * 0.1   # classification overhead per item
  )
  parallelism_factor = host_parallelism[host_agent]   # 1.0 to 4.0
```

### Coefficient tables

The coefficients are **conservative defaults** the user can override. They are
empirical estimates based on the per-category directive's expected performance.
After real migrations, the user (or AugmentIQ) can update these to match
actual data.

**Volume per hour by source category (GB/hr):**

| Source category | Coefficient | Notes |
|---|---|---|
| `local_files` | 5.0 | Direct filesystem read, no API overhead |
| `cloud_storage` (Drive, Dropbox, OneDrive, iCloud) | 0.4 | API rate limits apply |
| `standard_saas` (Notion, Confluence, Slack, GitHub, Linear, HubSpot) | 0.3 | API rate limits + variable page sizes |
| `email` (Gmail, Outlook, IMAP) | 0.2 | IMAP is slow; Gmail API is faster but rate-limited |
| `enterprise_platform` | n/a | Routed to customdev@upsurge.ae, not auto-estimated |

**Items per hour by source category:**

| Source category | Coefficient | Notes |
|---|---|---|
| `local_files` | 10000 | Local files, fast enumeration |
| `cloud_storage` | 5000 | API pagination |
| `standard_saas` | 5000 | API pagination |
| `email` | 2000 | IMAP is slow; per-message overhead |

**Host parallelism factor:**

| Host agent | Factor | Notes |
|---|---|---|
| `hermes` | 2.0 | Hermes is multi-threaded for I/O |
| `openclaw` | 4.0 | OpenClaw has parallel workers |
| `claude_code` | 1.5 | Single-threaded for most ops, parallel for I/O |
| `codex` | 1.5 | Same as Claude Code |
| `cursor` | 1.5 | Same |
| `nanobot` | 1.0 | Single-threaded |
| `letta_code` | 2.0 | Multi-threaded |

**Source for host parallelism:** OpenClaw README confirms "first-class tools"
including parallel scheduling. Other agents are typically single-threaded.
Adjust as we get real data.

---

## Estimated completion date

```
estimated_completion_date = today + ceil(estimated_transfer_time_hours / hours_per_night)

Where:
  hours_per_night = 6   # default 2am-8am nightly batch window
```

**For `one_shot` strategy**, the estimated completion is the wall-clock time
from the start, not a date:

```
estimated_completion_one_shot = now + estimated_transfer_time_hours
```

---

## Worked examples

### Example 1: Individual with 2GB Obsidian folder

- `volume_gb = 2`, `item_count = 8000` (estimate)
- `source_category = local_files`
- `host_agent = hermes`
- `volume_hours = 2 * 5.0 = 10 / 2.0 = 5.0`
- Wait, that's not right. Let me redo the math per the formula:
  - `volume_hours = volume_gb * volume_per_hour_coefficient[local_files] = 2 * 5.0 = 10`
  - Wait, that's 10 hours for 2GB. That's actually correct — the coefficient
    means "5 GB per hour", so 2GB takes 2/5 = 0.4 hours.

Let me re-state the formula correctly. The coefficient is **throughput**, so
the time is `volume_gb / coefficient`, not `volume_gb * coefficient`. Corrected:

```
estimated_transfer_time_hours = (
    volume_gb / volume_per_hour_coefficient[source_category]
    + item_count / item_per_hour_coefficient[source_category]
    + transformation_overhead_hours
) / parallelism_factor
```

This is more intuitive. **Re-derive worked examples with the corrected math.**

---

### Example 1 (corrected): Individual with 2GB Obsidian folder

- `volume_gb = 2`, `item_count = 8000`
- `source_category = local_files`, `host_agent = hermes`
- `volume_time = 2 / 5.0 = 0.4 hours`
- `item_time = 8000 / 10000 = 0.8 hours`
- `transformation_overhead = 0.05 * 2 + 0.001 * 8000 * 0.1 = 0.1 + 0.8 = 0.9 hours`
- `estimated_transfer_time = (0.4 + 0.8 + 0.9) / 2.0 = 2.1 / 2.0 = 1.05 hours`

**Output to user:** "Your 2GB Obsidian folder with ~8,000 items will take
approximately **1 hour** in one session (recommended for one_shot strategy)."

**Strategy recommendation:** `one_shot` (volume ≤ 1GB AND items ≤ 10k? no,
volume is 2GB which is > 1). Wait, the strategy decision tree (in
`strategies.md`) checks `volume_gb ≤ 1 AND item_count ≤ 10000`. Here
`volume_gb = 2 > 1` so strategy is `nightly_batches` by default.

Let me re-check: `volume_gb = 2`, threshold is `≤ 1` for one_shot. So
2GB goes to `nightly_batches` even though item_count is 8k.

That's a bit conservative but defensible — we don't want to be wrong about
"this fits in one session" and have it overflow. The user can override.

**Output to user:** "Recommended: nightly_batches of medium_1000 items,
starting tonight at 2am. Estimated **1 batch** (8,000 items, ~1 hour per
batch with overhead). Completion by tomorrow morning."

---

### Example 2: Department with 50GB SharePoint

- `volume_gb = 50`, `item_count = 200000`
- `source_category = cloud_storage` (SharePoint is in this category)
- `host_agent = openclaw`
- `volume_time = 50 / 0.4 = 125 hours`
- `item_time = 200000 / 5000 = 40 hours`
- `transformation_overhead = 0.05 * 50 + 0.001 * 200000 * 0.1 = 2.5 + 20 = 22.5 hours`
- `estimated_transfer_time = (125 + 40 + 22.5) / 4.0 = 187.5 / 4.0 = 46.9 hours`

**Output to user:** "Your 50GB SharePoint with ~200,000 items will take
approximately **47 hours of processing** total. Recommended: nightly_batches
of large_10000 items, 6 hours per night. Estimated **8 nights** of batches.
Completion by ~2026-08-24 (8 days from start)."

---

### Example 3: Department with 800GB Salesforce

- `volume_gb = 800`, `item_count = 2000000`
- `source_category = enterprise_platform`
- **Strategy:** `paused` (volume > 500GB OR item_count > 1M)

**Output to user:** "This is enterprise-scale. AugmentIQ does not auto-ingest
enterprise platforms. We'll route this to customdev@upsurge.ae for a paid
migration engagement. Expected timeline: 4-8 weeks. Expected cost:
$25k-$80k depending on schema complexity. Add this to your
`/augmentiq status` as `pending_migration` and email our team?"

---

## Calibration

These coefficients are **conservative defaults**. After real migrations, the
user (or AugmentIQ) can update them in the per-category directive
(`references/ingest/<category>.md`) to match actual data.

The calibration process:

1. Run a real migration.
2. Note the actual `estimated_transfer_time_hours` vs. the predicted.
3. If actual is consistently 2x the prediction, halve the coefficients (or
   double the parallelism factor).
4. Update the coefficient table in this document.
5. Commit the change as a minor-version bump to the skill.

**The coefficients are not magic numbers.** They are empirical estimates that
get better with each migration. The first 5 migrations will produce real data
to calibrate against.

---

## Edge cases

- **No `volume_gb` or `item_count` provided:** estimator returns "Cannot
  estimate without volume or item count. Please provide at least one."
- **Both provided:** use the larger of the two time estimates, to be
  conservative.
- **`item_count = 0`:** ignore the item_time term (it's zero anyway), use
  volume only.
- **`volume_gb = 0`:** ignore the volume_time term, use item count only.
- **Both zero:** estimator returns "Cannot estimate: both volume and item
  count are zero. Please provide at least one."

---

## What the estimator does NOT do

- It does not actually start the migration. The user must confirm with
  `/augmentiq ingest` after seeing the estimate.
- It does not handle authentication. The user must have already set up the
  auth method for the source (e.g., Google Drive OAuth, Salesforce API key).
- It does not pre-flight the target backend. The target must be reachable
  before the migration starts.
- It does not handle rate-limit detection mid-migration. That's a runtime
  concern in the per-category directive.

---
