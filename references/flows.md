# The 10 Operational Flows

---
## Flow 1: detect

**Trigger:** every invocation of any AugmentIQ command, AND on every agent
session start (per the Agent Skills spec's "Activation" stage).

**Pre-conditions:** none. Detect runs always.

**Goal:** Identify the host agent, host OS, and memory backend in one pass. Cache the result for the session.

**Constraints:**
1. Always read the host agent's filesystem marker first (`~/.hermes/`, `~/.openclaw/`, `~/.claude/`, etc.) — never assume.
2. If a host marker is found, run `<agent> --version`; on failure, read the agent's version file. Do not proceed without a `host_agent` value.
3. Detect `host_os` via `process.platform`; override to `container` if `/.dockerenv` or `KUBERNETES_SERVICE_HOST` is present.
4. Detect the memory backend: filesystem markers for `obsidian` / `hermes_native`; API key + `/v1/whoami` for `mem0` / `reme`; ask the user for `custom`.
5. Cache the result for the session — do not re-detect mid-session.


**Confirmation points:** none. Detect is read-only.

**Outputs:** the live `host` and `memory` Tier 2/3 variables, used by all
subsequent commands in the session.

**Failure modes:**
- No marker found: ask the user to confirm the host agent manually.
- `<agent> --version` fails: ask the user for the version, or default to `unknown`.
- Cloud backend API unreachable: ask the user to verify the backend is running
  and the API key is correct.

**Audit log entry:** none. Detect is silent.

---

## Flow 2: init

**Trigger:** `/augmentiq init` (or `/augmentiq init --defaults` for the
escape-hatch flow, or `/augmentiq init --reset` to wipe and restart).

**Pre-conditions:** none. Init creates the config.

**Goal:** Produce a valid `~/.augmentiq/config.yaml` and register the cron set, with explicit user confirmation before any write.

**Constraints:**
1. On first activation when `config.yaml` is missing, run the questionnaire for the detected `unit_type` (5/11/17/22 questions).
2. Compute smart defaults from prior answers; never ask a question whose answer is derivable.
3. After every 5 questions, checkpoint with the user before continuing.
4. Before writing config, show the full plan (which crons, which sources, which compliance features, which schedule). Require typed confirmation per Principle 4.
5. On confirm: atomic write (temp + rename), register crons, log init to timeline. On reject: discard, instruct re-run, log the rejection.


**Confirmation points:** step 10 (the per-action confirmation). Plus the
"continue after every 5 questions" sub-prompts.

**Outputs:**
- `~/.augmentiq/config.yaml` (the canonical config)
- `~/.augmentiq/crons.yaml` (the cron registry)
- One timeline entry for the init
- The agent is now ready to run any other AugmentIQ command

**Failure modes:**
- Config write fails (permission denied, disk full): the agent surfaces the
  error and offers to retry. No partial config is left on disk.
- Cron registration fails for one cron: the agent registers the others,
  surfaces the failed one, offers to retry. Partial success is logged.
- User rejects at step 10: no changes are made. The user can re-run.

**Audit log entry:**
```json
{
  "action": "init",
  "actor": "<owner_name>",
  "unit_type": "<individual|team|department|organisation>",
  "config_hash": "<sha256 of written config>",
  "crons_registered": ["daily-snapshot", "weekly-review", "monthly-retention"],
  "legacy_sources_count": 0,
  "compliance_packs": [],
  "user_confirmed": true
}
```

---

## Flow 3: capture

**Trigger:** `/augmentiq snapshot`, `/augmentiq save <thing>`, or any cron
cadence (daily-snapshot, weekly-review, on-event).

**Pre-conditions:** `~/.augmentiq/config.yaml` exists and is valid.

**Goal:** Persist a new context record with correct classification, tags, and audit reference, with user confirmation before any write.

**Constraints:**
1. Every record gets PII auto-classification per `references/ingest/pii-patterns.md` before write.
2. Apply the source's default classification; PII upgrades are mandatory, not advisory.
3. Show the preview (count, classification breakdown, sample of 3 records) before any bulk write >100 items.
4. Per-record writes require per-action confirmation per Principle 4.
5. Every action writes a timeline entry per the command-specific audit log shape in `references/commands.md`.


**Confirmation points:**
- Every bulk action (snapshot, ingest batch >100 items): per-batch confirmation
- Every single-record action (save, tag): per-action confirmation
- Cron-fired captures: confirmation queued for next active session, max 7-day
  wait, then auto-discard with alert

**Outputs:** one or more AugmentIQ Context Records in the memory backend, plus
one timeline entry per action.

**Failure modes:**
- Memory backend write fails: the agent retries up to 3 times, then surfaces
  the error. The user can `/augmentiq reconfigure` to fix the backend location
  and retry.
- Record schema validation fails: the agent surfaces the specific field that
  failed, offers to fix it (per Principle 2: the user can override).
- PII detection false positive: the user can override the classification
  before confirm.

**Audit log entry:** per action, per the format in `references/commands.md`.

---

## Flow 4: retention

**Trigger:** `monthly-retention` cron (1st of each month, 03:00) OR
`/augmentiq retention --enforce` (manual trigger).

**Pre-conditions:** config has a `retention_period_days` map. Records exist
in the memory backend.

**Goal:** Enforce retention policy per classification, archive where applicable, delete where mandated, with double confirmation and a pre-destroy export.

**Constraints:**
1. Pre-destroy export is mandatory: write the full deletion list to `~/.augmentiq/exports/<timestamp>-pre-retention.jsonl` BEFORE any delete.
2. Double confirmation: a typed confirmation after the summary, not just a yes/no.
3. If user does not confirm within 14 days, the cron is auto-disabled and records remain in place; the policy is unchanged.
4. Archive where applicable: archive records >1 year past expiration; delete records >2 years past expiration. Per-record, not batch.
5. Per-record: the deletion writes the content hash to the timeline (proof the content is gone) but does not retain the content itself.


**Confirmation points:** step 4 (the double confirmation). This is the
highest-risk action AugmentIQ takes.

**Outputs:**
- The pre-destroy export (`.jsonl` file)
- Modified records (archived, with archive markers)
- Deleted records (gone, with content hashes in the timeline)
- One timeline entry per retention enforcement

**Failure modes:**
- User doesn't confirm within 14 days: cron is auto-disabled, records
  remain in place, user alerted. The *policy* is unchanged, just the
  *enforcement* is paused.
- Memory backend write fails mid-deletion: rolls back to the pre-deletion
  state. The deletion is atomic. The user is alerted to retry.
- Archive path not writable: refuses to proceed, user asked to verify
  archive location.

**Audit log entry:**
```json
{
  "action": "retention_enforce",
  "actor": "<owner_name>",
  "window_start": "2026-07-01T00:00:00Z",
  "window_end": "2026-08-01T00:00:00Z",
  "records_archived": {
    "public": 0,
    "internal": 2,
    "confidential": 10,
    "restricted": 0
  },
  "records_deleted": {
    "public": 0,
    "internal": 0,
    "confidential": 0,
    "restricted": 4
  },
  "export_path": "~/.augmentiq/exports/2026-08-01-pre-retention.jsonl",
  "user_confirmed": true
}
```

---

## Flow 5: audit

**Trigger:** `quarterly-audit` cron (last day of each quarter, 04:00) OR
`/augmentiq audit` (manual trigger).

**Pre-conditions:** timeline has events in the audit window.

**Goal:** Generate the quarterly audit report (JSON + Markdown) with pack-specific fields, log the audit itself.

**Constraints:**
1. Default window is since-last-audit, capped at 1 year.
2. Per compliance pack: enrich each event with the pack's required fields (legal basis for GDPR, control mapping for SOC2, etc.).
3. Generate both `~/.augmentiq/audits/<timestamp>.json` and `~/.augmentiq/audits/<timestamp>.md`. Both are first-class outputs.
4. If the timeline has >1M events in the window, generate a partial report with a truncation note. Do not silently drop events.
5. Log the audit itself to the timeline (audits are auditable).


**Confirmation points:** none. Read-only + write-to-user-fs.

**Outputs:**
- `~/.augmentiq/audits/<timestamp>.json` (machine-readable)
- `~/.augmentiq/audits/<timestamp>.md` (human-readable)
- One timeline entry for the audit
- Optional: webhook notification

**Failure modes:**
- Timeline too large (>1M events in window): generates a partial report with
  a note about truncation. User can re-run with a smaller window.
- Compliance pack missing required field: report includes a warning, not a
  failure.
- Webhook unreachable: report is still saved, webhook retry queued.

**Audit log entry:**
```json
{
  "action": "audit",
  "actor": "<owner_name>",
  "window_start": "2026-04-01T00:00:00Z",
  "window_end": "2026-07-01T00:00:00Z",
  "events_included": 1247,
  "packs_reported": ["gdpr", "soc2"],
  "report_path": "~/.augmentiq/audits/2026-07-01.json",
  "user_confirmed": true
}
```

---

## Flow 6: migration

**Trigger:** `/augmentiq migrate --to <backend>` (manual trigger).

**Pre-conditions:** records exist in the source backend.

**Goal:** Move records from source backend to target backend with a lossiness report and reversible source data.

**Constraints:**
1. Before any write: read all source records, transform to canonical Context Record format, estimate lossiness, show the plan.
2. Typed confirmation (`migrate`) required before any record is written to the target.
3. On write failure, continue with the remaining records, log per-record failures, do not abort the batch.
4. Source data is preserved until the user explicitly confirms the target. The user can roll back at any time (Principle 3: bidirectional).
5. Generate a lossiness report at `~/.augmentiq/migrations/<timestamp>.md` on completion. Update `memory_backend` and `memory_location` in config only after the report is written.


**Confirmation points:** step 5 (typed confirmation).

**Outputs:**
- Records in the target backend
- Updated `config.yaml` with the new `memory_backend` and `memory_location`
- Lossiness report at `~/.augmentiq/migrations/<timestamp>.md`
- One timeline entry for the migration

**Failure modes:**
- Source or target backend unreachable: refuses to proceed, suggests
  diagnostics.
- Network interruption mid-migration: rolls back to source (per Principle 3:
  source remains authoritative), logs the partial failure, offers retry.
- Disk full on target: stops, surfaces the error, asks user to free space.

**Audit log entry:**
```json
{
  "action": "migrate",
  "actor": "<owner_name>",
  "source_backend": "mem0",
  "target_backend": "obsidian",
  "records_transferred": 1247,
  "records_approximated": 0,
  "records_discarded": 0,
  "duration_seconds": 462,
  "lossiness_report_path": "~/.augmentiq/migrations/2026-07-16.md",
  "user_confirmed": true
}
```

---

## Flow 7: legacy_ingest

**Trigger:** `/augmentiq ingest` (manual) or `ingest-batch` cron (nightly).

**Pre-conditions:** `legacy_sources[]` is non-empty in config.

**Goal:** Bring historical data into the memory backend, with per-source strategy and per-batch audit, while routing enterprise platforms to the human engagement.

**Constraints:**
1. Per-source strategy is derived from `volume_gb` + `item_count` per `references/ingest/strategies.md`: one_shot ≤ 1GB / 10k items; nightly_batches ≤ 500GB / 1M items; paused otherwise.
2. If `source_category = enterprise_platform`, route to `customdev@upsurge.ae` — do not auto-ingest. Generate the email draft, require user confirmation before sending.
3. Per-source confirmation at ingest start. Per-batch confirmation if `items_attempted > 100`. Below 100, queue for next active session.
4. PII auto-classification runs on every record before write.
5. Every batch produces one timeline entry per `references/ingest/batch_protocol.md` with the 11 required fields.


**Confirmation points:**
- At ingest start: per-source confirmation
- Per batch (if `items_attempted > 100`): per-batch confirmation
- Enterprise platform routing: per-source confirmation before adding to
  `pending_migration`

**Outputs:** records in the memory backend (for agent-native sources),
or a `pending_migration` status + email draft (for enterprise sources),
plus timeline entries.

**Failure modes:**
- Auth failure: source marked `auth_failed`, cron disabled for that source,
  user alerted.
- Rate limit: agent handles natively, AugmentIQ logs the backoff duration.
- Transformation failure: items marked failed, batch continues, summary
  reports the failures.

**Audit log entry:** per source, per batch. Format in `references/commands.md`.

---

## Flow 8: dsr

**Trigger:** `/augmentiq dsr <id> --type <access|erasure|rectification|portability>`.

**Pre-conditions:** the user has received a DSR (from a customer, employee,
or other data subject) and needs to fulfill it under GDPR (or another
regulation that grants similar rights).

**Goal:** Fulfill a data subject request (access, erasure, rectification, portability) with logged steps and a completion report.

**Constraints:**
1. Parse the DSR ID, type, and subject identifier. Match the subject across all backends.
2. Per type: access → collect + export; erasure → identify + redact (preserves audit hash, content gone); rectification → apply correction + log; portability → run `/augmentiq export` filtered to the subject.
3. Show the action + scope + basis (GDPR Art. 15/16/17/20 or analogous) before any destructive step. Require per-action confirmation per Principle 4.
4. Generate a DSR completion report at `~/.augmentiq/dsr/<id>-report.md` with every step timestamped.
5. If `dpo_contact` is configured, notify the DPO on completion.


**Confirmation points:** step 5 (per-action confirmation).

**Outputs:**
- Modified records (redacted, corrected, or exported per type)
- DSR completion report
- Timeline entries (one per step)
- Optional DPO notification

**Failure modes:**
- Subject not found in any backend: "No records found for subject
  '<subject>'. DSR closed as no-action." Logged to timeline.
- Multiple subjects match: asks user to disambiguate.
- SLA deadline approaching: warns, prioritises the request.

**Audit log entry:**
```json
{
  "action": "dsr_fulfillment",
  "actor": "<owner_name>",
  "dsr_id": "2026-007",
  "type": "erasure",
  "subject": "jane.doe@example.com",
  "regulation_basis": "GDPR Article 17",
  "records_affected": 4,
  "backends_affected": ["mem0", "obsidian", "hermes_native"],
  "report_path": "~/.augmentiq/dsr/2026-007-report.md",
  "sla_deadline": "2026-08-01",
  "user_confirmed": true
}
```

---

## Flow 9: failure_ux

**Trigger:** any agent error, cron miss, validation failure, or backend
unreachable event.

**Pre-conditions:** the failure has been detected.

**Goal:** Surface any failure (write, auth, retention, audit, migration, ingest, DSR, destroy) with a specific recovery action, without silent continuation.

**Constraints:**
1. Categories: write failure (retry 3x, then surface), auth failure (mark source `auth_failed`, alert), cron missed firing (alert on next status), cron fired but action failed (alert on 3 consecutive failures), validation failure (surface the specific field), backend unreachable (pause subsequent commands), destructive action in progress (refuse overlapping destructive).
2. Never retry silently. Every retry attempt is logged.
3. If 3 consecutive batch failures, the source is marked `failed` and the cron is disabled. The user is alerted with the specific failure codes.
4. If a queued confirmation is not addressed within 7 days, the queued action is auto-discarded and the cron that would have triggered is auto-disabled.
5. Recovery actions are themselves logged: post-mortem via the timeline.


**Confirmation points:** depends on the recovery action. Generally, the
recovery action surfaces a confirmation prompt before it modifies anything.

**Outputs:** timeline entries, alerts to the user.

**Failure modes:**
- Recovery itself fails: AugmentIQ escalates to the next-level recovery
  (e.g., reinstall → manual intervention).

**Audit log entry:** per failure, per recovery. The timeline becomes a
post-mortem record.

---

## Flow 10: destroy

**Trigger:** `/augmentiq destroy [--wipe-data] [--keep-config]`.

**Pre-conditions:** the user is certain. This is irreversible (without a
backup).

**Goal:** Tear down AugmentIQ (disable crons, stop ingest, optionally wipe data) with triple confirmation and a destruction log.

**Constraints:**
1. Three confirmations: summary → typed `destroy` → typed `destroy-permanently`. The third is required even if `--keep-config`.
2. If `--wipe-data`, a fourth confirmation is required. Without `--wipe-data`, the config is preserved (the user can re-activate).
3. Disable all crons first; stop any in-progress ingest; only then consider data wipe.
4. Save the destruction log to `~/.augmentiq/destroyed/<timestamp>.log` BEFORE any wipe. The log itself is the proof the destroy happened.
5. Per Principle 3: this is the only path that makes data unrecoverable. Every other path preserves source data.


**Confirmation points:** steps 1, 2, 4 (three confirmations, with the
third only if `--wipe-data`).

**Outputs:**
- Disabled crons
- Optionally wiped data
- Destruction log
- Final timeline entry (or no timeline if `--wipe-data`)

**Failure modes:**
- Cron disable fails: the agent retries, surfaces the error, instructs
  the user to manually disable.
- Wipe fails mid-way: the agent continues, logs the partial failure,
  reports what was wiped and what remains.

**Audit log entry:** the destruction is the last entry.

```json
{
  "action": "destroy",
  "actor": "<owner_name>",
  "crons_disabled": 4,
  "legacy_sources_stopped": 1,
  "data_wiped": false,
  "config_preserved": true,
  "destruction_log": "~/.augmentiq/destroyed/2026-07-16T14-30-00Z.log",
  "user_confirmed": true
}
```

---

## The 10-flow summary

| # | Flow | Trigger | Destructive? | Confirmation? | Audit? |
|---|---|---|---|---|---|
| 1 | detect | every invocation | no | no | no (silent) |
| 2 | init | /augmentiq init | no | yes (per-action) | yes |
| 3 | capture | /augmentiq snapshot/save/tag/cron | partial | yes (per-action) | yes |
| 4 | retention | monthly-retention cron or manual | YES | yes (typed) | yes |
| 5 | audit | quarterly-audit cron or manual | no | no | yes |
| 6 | migration | /augmentiq migrate | YES | yes (typed) | yes |
| 7 | legacy_ingest | /augmentiq ingest or ingest-batch | partial | yes (per-batch) | yes |
| 8 | dsr | /augmentiq dsr | YES | yes (per-action) | yes |
| 9 | failure_ux | any failure | depends | depends | yes |
| 10 | destroy | /augmentiq destroy | YES | yes (typed, double) | yes (last) |

**The flows cover every command and every cron cadence.** The SKILL.md body
points to this document when the agent needs to know the steps.

---

**End of flows.md**
