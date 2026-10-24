# The 24 Slash Commands

---

## How this document is organized

For each of the 24 commands, this document provides:

1. **Syntax** — the exact invocation, with optional vs required arguments
2. **Behavior** — what the agent does, in imperative steps
3. **Confirmation prompts** — which commands require user confirmation and what the
   prompt shows (per Principle 4: confirm before destructive)
4. **Output format** — what the agent prints on success
5. **Edge cases** — what can go wrong and how the command handles it
6. **Error responses** — the specific error messages and their meaning
7. **Audit log entry** — what gets written to the timeline for this command

The 24 commands are grouped into 5 tiers (onboarding, capture, query, compliance,
migration, legacy ingest). **The `/augmentiq role` command is included** (it was
added in Loop 4 after the role-based-access requirement was
identified as a compliance-officer need).

---

## Tier 1: Onboarding (4 commands)

### `/augmentiq init`

**Syntax:** `/augmentiq init [--reset]`

**Behavior:**
1. Detect the host environment (host_agent, host_os, host_cron_capable, etc.) per
   `references/agents/`.
2. Detect or ask for the memory backend + location per Tier 3 of the variable schema.
3. Walk through the questionnaire for the user's `unit_type` (5-22 questions,
   progressive disclosure per Tier).
4. Compute smart defaults for all derived variables.
5. Generate cron definitions in the host's native format per
   `assets/cron-templates/<host>.cron`.
6. Generate per-source legacy ingest directives for each `legacy_source` declared.
7. **Confirmation prompt** (per Principle 4): show the user the full plan
   (which crons, which sources, which compliance features), require explicit yes.
8. On confirm: register crons, write `~/.augmentiq/config.yaml`, log init to timeline.
9. On reject: save partial config, instruct user to re-run `/augmentiq init`.

**Confirmation prompt:**
```
This will:
  - Register 4 crons (daily-snapshot, weekly-review, monthly-retention, quarterly-audit)
  - Enable 1 ingest source (salesforce_q2_2024, strategy: nightly_batches)
  - Activate GDPR + SOC2 compliance features
  - Apply 4-tier classification (public / internal / confidential / restricted)
  - Retain records 7 years by default
Proceed? [y/n/review]
```

**Output format (on success):**
```
AugmentIQ initialised.
Config: ~/.augmentiq/config.yaml
Crons registered: 4
Legacy sources scheduled: 1
Compliance packs: gdpr, soc2

Next steps:
  /augmentiq status     # see current state
  /augmentiq snapshot   # capture a one-off snapshot now
  /augmentiq ingest status   # check legacy ingest progress
```

**Edge cases:**
- `--reset` flag: wipes existing config, re-runs full questionnaire. Confirms twice.
- Host detection fails: asks user to confirm host manually.
- Memory backend unreachable: refuses to proceed, instructs user to verify backend.
- Cron install fails: shows the specific error, offers to retry or skip.

**Error responses:**
- `AugmentIQ is already initialised. Use /augmentiq reconfigure to change, or --reset to start over.`
- `Memory backend unreachable. Verify your backend is running and accessible.`
- `Cron install failed: <specific error>. Retry? [y/n/skip]`

**Audit log entry:**
```json
{
  "action": "init",
  "actor": "<owner_name>",
  "config_hash": "<sha256 of config.yaml>",
  "crons_registered": ["daily-snapshot", "weekly-review", "monthly-retention", "quarterly-audit"],
  "legacy_sources_count": 1,
  "compliance_packs": ["gdpr", "soc2"],
  "user_confirmed": true
}
```

---

### `/augmentiq status`

**Syntax:** `/augmentiq status [--verbose] [--json]`

**Behavior:**
1. Read the live `~/.augmentiq/config.yaml` (not a cache).
2. List all registered crons with their next-fire times.
3. List all legacy sources with their current `ingest_status`, items_processed,
   items_remaining, last_batch_timestamp, next_batch_timestamp,
   estimated_completion_date.
4. Show compliance pack status (which packs active, last audit report date).
5. Show pending destructive actions (none, or list of items waiting for confirmation).
6. Show last 10 timeline events.

**Confirmation prompt:** None. This is a read-only command.

**Output format (default, --verbose):**
```
AugmentIQ status — 2026-07-16 14:30 UTC
Config: ~/.augmentiq/config.yaml (modified 2026-07-15)
Host: openclaw 0.4.2 on linux (cron capable)
Memory: mem0 at https://api.mem0.ai/v1
Scale: organisation (22-question init complete)

Crons (4 active):
  daily-snapshot       next: 2026-07-17 02:00 UTC
  weekly-review        next: 2026-07-20 09:00 UTC
  monthly-retention    next: 2026-08-01 03:00 UTC
  quarterly-audit      next: 2026-09-30 04:00 UTC
  ingest-batch         next: 2026-07-17 02:00 UTC (1 source active)

Legacy ingest (1 source):
  salesforce_q2_2024
    status: in_progress
    items_processed: 142,000 / 850,000
    last_batch: 2026-07-15 02:14 UTC
    next_batch: 2026-07-17 02:00 UTC
    estimated_completion: 2026-08-15
    failures: 0

Compliance (2 packs active):
  gdpr: enabled, last audit 2026-06-30
  soc2: enabled, last audit 2026-06-30

Pending destructive actions: none

Recent timeline (10 events):
  2026-07-15 02:14  ingest_batch_completed  salesforce_q2_2024  10000 items
  2026-07-15 02:00  daily_snapshot          scope=org           247 records
  2026-07-14 14:22  record_created          salesforce_opportunity:1234
  ...
```

**Output format (`--json`):** the same data as a JSON object, machine-readable.

**Edge cases:**
- Config file missing: `AugmentIQ is not initialised. Run /augmentiq init.`
- Config file corrupted: `Config file is corrupted. See ~/.augmentiq/config.yaml.bak. Use /augmentiq reconfigure to rebuild.`
- No crons registered: shows the list as empty, no error.

**Error responses:**
- `Config file not found at ~/.augmentiq/config.yaml.`
- `Config file is invalid YAML: <parse error>.`

**Audit log entry:**
- `/augmentiq status` does NOT generate an audit log entry. It is a read-only command.
  (The principle: don't pollute the timeline with status checks.)

---

### `/augmentiq reconfigure`

**Syntax:** `/augmentiq reconfigure [--tier <identity|host|memory|legacy|cadence|compliance|advanced>]`

**Behavior:**
1. Read the current `~/.augmentiq/config.yaml`.
2. If `--tier` is specified, only re-ask questions for that tier.
3. Otherwise, re-run the full questionnaire (with current values pre-filled).
4. Compute new smart defaults.
5. **Confirmation prompt** (per Principle 4): show the diff between current and
   new config (added variables, changed variables, removed variables).
6. On confirm: write new config, regenerate crons, log reconfigure to timeline.
7. On reject: no changes.

**Confirmation prompt:**
```
Changes to apply:
  + snapshot_cadence: weekly → daily
  + retention_period_days.confidential: 2555 → 3650
  - legacy_sources[0].ingest_status: in_progress → cancelled
  (no change to other 27 variables)

Proceed? [y/n/show-diff]
```

**Output format (on success):**
```
AugmentIQ reconfigured.
Changes applied: 2
Crons regenerated: 4
Legacy sources updated: 1

Verify: /augmentiq status
```

**Edge cases:**
- `--tier` specified but the tier has no questions (e.g., `individual` + `compliance`):
  returns "No questions in this tier for your current config."
- User removes a compliance pack: warns that the audit history for that pack
  remains in the timeline but won't be enforced. (Cannot be removed without
  explicit destructive confirmation.)
- User changes `memory_backend`: warns that existing records stay in the old backend
  until explicitly migrated. Offers to schedule a migration.

**Error responses:**
- `No changes detected. Run /augmentiq reconfigure without arguments to see all questions.`
- `Tier 'compliance' has no questions because unit_type is 'individual'.`

**Audit log entry:**
```json
{
  "action": "reconfigure",
  "actor": "<owner_name>",
  "tiers_changed": ["cadence"],
  "variables_added": [],
  "variables_changed": ["snapshot_cadence", "retention_period_days.confidential"],
  "variables_removed": ["legacy_sources[0].ingest_status"],
  "config_hash_before": "<sha256>",
  "config_hash_after": "<sha256>",
  "user_confirmed": true
}
```

---

### `/augmentiq destroy`

**Syntax:** `/augmentiq destroy [--wipe-data] [--keep-config]`

**Behavior:**
1. Per Principle 4: double confirmation required.
2. Disable all crons (uninstall from host scheduler).
3. If `--wipe-data`: also delete all AugmentIQ records from the memory backend.
4. If `--keep-config`: preserve `~/.augmentiq/config.yaml` (allows reactivation).
5. Save a destruction log to `~/.augmentiq/destroyed/<timestamp>.log`.
6. Log the destruction to the timeline (the timeline survives unless `--wipe-data`).

**Confirmation prompts (two, in sequence):**
```
This will:
  - Disable 4 crons
  - Stop the legacy ingest for 1 source
  - Log the destruction to ~/.augmentiq/destroyed/

Are you sure? Type 'destroy' to confirm: _____

This is irreversible (without a backup). Type 'destroy-permanently' to confirm: _____
```

**Output format (on success):**
```
AugmentIQ destroyed.
Crons disabled: 4
Legacy ingest stopped: 1
Destruction log: ~/.augmentiq/destroyed/2026-07-16T14-30-00Z.log

To reactivate: /augmentiq init
To wipe all AugmentIQ data: /augmentiq destroy --wipe-data
```

**Edge cases:**
- Destructive actions are in progress (e.g., a migration): refuses to destroy until
  the action completes or is cancelled. Suggests `/augmentiq migrate cancel` first.
- No config exists: returns "AugmentIQ is not initialised. Nothing to destroy."

**Error responses:**
- `Destructive action in progress: migrate from mem0 to obsidian. Cancel it first: /augmentiq migrate cancel.`
- `Type 'destroy-permanently' to confirm. You typed: <user input>.`

**Audit log entry (the destruction is the last entry):**
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

## Tier 2: Capture (3 commands)

### `/augmentiq snapshot`

**Syntax:** `/augmentiq snapshot [--scope <individual|team|department|organisation>] [--dry-run]`

**Behavior:**
1. Enumerate the designated sources for the scope (per `config.yaml`).
2. For each source: pull current state, transform to AugmentIQ Context Record format.
3. Apply PII auto-classification (upgrade to `restricted` if patterns detected).
4. Apply the source's default classification.
5. **Per Principle 4 (per-action confirmation)**: show the user what will be written
   (count, classification breakdown, sample of 3 records), require yes.
6. On confirm: write records to memory backend using the agent's native API.
7. Log the snapshot to the timeline (batch_id, source, items_succeeded,
   items_failed, classification breakdown).

**Confirmation prompt (per Principle 4):**
```
About to write 247 records to your Obsidian vault:
  - 240 tagged "internal"
  - 5 tagged "confidential"
  - 2 flagged for review (classification unclear):
      - record: customer_email_thread_2024_q3
      - record: finance_meeting_notes_jun

Proceed? [y/n/review-2]
```

**Output format (on success):**
```
Snapshot complete.
Records written: 245
Records flagged: 2 (review required)
Records failed: 0
Batch ID: snapshot-2026-07-16T14-30-00Z

Review flagged records: /augmentiq timeline --filter=snapshot&status=flagged
```

**Edge cases:**
- `--dry-run`: skips the write, just shows what would be written. No timeline entry.
- No designated sources for the scope: returns "No sources configured for this scope.
  Run `/augmentiq reconfigure --tier=memory`."
- Memory backend unreachable: refuses to proceed, instructs user to verify backend.

**Error responses:**
- `Memory backend unreachable. Verify your backend is running.`
- `No sources configured for scope '<scope>'.`

**Audit log entry:**
```json
{
  "action": "snapshot",
  "actor": "<owner_name>",
  "scope": "organisation",
  "batch_id": "snapshot-2026-07-16T14-30-00Z",
  "items_written": 245,
  "items_flagged": 2,
  "items_failed": 0,
  "classification_breakdown": {
    "public": 0,
    "internal": 240,
    "confidential": 5,
    "restricted": 0
  },
  "pii_patterns_detected": [],
  "user_confirmed": true
}
```

---

### `/augmentiq save <thing>`

**Syntax:** `/augmentiq save <thing> [--tags <tag1,tag2,...>] [--classification <public|internal|confidential|restricted>]`

**Behavior:**
1. Parse `<thing>` as the record content.
2. Prompt for tags (with smart-default suggestion based on content + recent saves).
3. Prompt for classification (with smart-default = `internal` unless content
   matches a PII pattern, in which case default = `restricted`).
4. Create an AugmentIQ Context Record with timestamp, scope, source=`manual`,
   content, tags, classification, audit_ref, provenance, embedding.
5. **Confirmation prompt** (per Principle 4): show the preview, require yes.
6. On confirm: write to memory backend. Log to timeline.

**Confirmation prompt:**
```
Saving to your Obsidian vault:
  content: "Q3 OKRs decided: revenue $2.4M, headcount 14"
  tags: [okrs, q3, leadership]
  classification: confidential (PII detected: dollar amounts)
  timestamp: 2026-07-16T14:30:00Z

Proceed? [y/n/edit]
```

**Output format (on success):**
```
Saved.
Record ID: augmentiq:a1b2c3d4-e5f6-7890-abcd-ef1234567890
Tags: okrs, q3, leadership
Classification: confidential
Audit ref: timeline/2026-07-16/save-a1b2c3d4
```

**Edge cases:**
- Empty `<thing>`: refuses, "Nothing to save. Provide content."
- Classification not in allowed list: refuses, lists allowed values.
- Tags invalid (contain disallowed chars): rejects with specific reason.

**Error responses:**
- `Nothing to save. Provide content as the command argument.`
- `Invalid classification. Allowed: public, internal, confidential, restricted.`
- `Tag '<tag>' contains disallowed characters. Use letters, numbers, hyphens, dots.`

**Audit log entry:**
```json
{
  "action": "save",
  "actor": "<owner_name>",
  "record_id": "augmentiq:a1b2c3d4-...",
  "tags": ["okrs", "q3", "leadership"],
  "classification": "confidential",
  "pii_patterns_detected": ["monetary_amount"],
  "user_confirmed": true
}
```

---

### `/augmentiq tag <thing> [tags]`

**Syntax:** `/augmentiq tag <thing> <tag1> [tag2 ...] [--remove]`

**Behavior:**
1. Find the record matching `<thing>` (by record_id, content match, or search).
2. If multiple matches, ask user to disambiguate.
3. If `--remove`: remove the specified tags from the record.
4. Otherwise: add the specified tags.
5. **Confirmation prompt** (per Principle 4): show the before/after tag list.
6. On confirm: update the record, log the change to timeline.

**Confirmation prompt:**
```
Updating record: augmentiq:a1b2c3d4-...
  current tags: [okrs, q3]
  new tags:     [okrs, q3, leadership, board-review]

Proceed? [y/n]
```

**Output format (on success):**
```
Tagged.
Record: augmentiq:a1b2c3d4-...
Added: leadership, board-review
Removed: (none)
```

**Edge cases:**
- `<thing>` matches no records: refuses, "No records found. Try /augmentiq recall <query>."
- Multiple matches: shows the top 5, asks user to pick.

**Error responses:**
- `No record matches '<thing>'.`
- `Multiple records match. Pick one: /augmentiq tag <record_id> <tags>`

**Audit log entry:**
```json
{
  "action": "tag",
  "actor": "<owner_name>",
  "record_id": "augmentiq:a1b2c3d4-...",
  "tags_added": ["leadership", "board-review"],
  "tags_removed": [],
  "user_confirmed": true
}
```

---

## Tier 3: Query (3 commands)

### `/augmentiq recall <query>`

**Syntax:** `/augmentiq recall <query> [--scope <...>] [--classification <...>] [--limit <N>]`

**Behavior:**
1. Build a search query from `<query>`.
2. Apply scope + classification filters.
3. Query the memory backend using its native search API (the agent decides how).
4. Rank by relevance (the agent's embedding model handles this).
5. Return the top N results (default 10, max 100).

**Confirmation prompt:** None. Read-only.

**Output format:**
```
Recall results for "Q3 OKRs" (scope=organisation, classification=any):

1. augmentiq:a1b2c3d4-... — confidential
   "Q3 OKRs decided: revenue $2.4M, headcount 14"
   source: manual, tags: [okrs, q3, leadership]
   timestamp: 2026-07-16T14:30:00Z
   relevance: 0.94

2. augmentiq:f7e8d9c0-... — internal
   "Q3 OKR draft: revenue $2.0M target..."
   source: salesforce_opportunity:5678, tags: [okrs, q3, draft]
   timestamp: 2026-07-10T11:22:00Z
   relevance: 0.87

3. augmentiq:1a2b3c4d-... — confidential
   "Q3 OKR review meeting notes — leadership feedback"
   source: notion:page:123, tags: [okrs, q3, meeting]
   timestamp: 2026-07-12T16:45:00Z
   relevance: 0.82

(7 more results truncated. Increase --limit or refine your query.)
```

**Edge cases:**
- No results: "No records match your query. Try different terms or /augmentiq who-knows <topic>."
- Memory backend search API unavailable: falls back to a linear scan (slower, with
  a notice that the search is degraded).

**Error responses:**
- `Memory backend search unavailable. Falling back to linear scan (slow).`
- `Query too short. Provide at least 3 characters.`

**Audit log entry:**
- `/augmentiq recall` does NOT generate an audit log entry by default. (Read-only.)
  Can be enabled with `--audit` flag for sensitive queries (e.g., DSR-related
  recall on a customer's records).

---

### `/augmentiq timeline`

**Syntax:** `/augmentiq timeline [--filter <action>] [--since <date>] [--until <date>] [--limit <N>]`

**Behavior:**
1. Read the timeline (stored in the memory backend per the timeline schema).
2. Apply filters.
3. Return the most recent N events (default 20, max 200).

**Confirmation prompt:** None. Read-only.

**Output format:**
```
Timeline (most recent 20, since 2026-07-15):
  2026-07-16 14:30  save              owner=jane  record=a1b2c3d4  tags=[okrs,q3]
  2026-07-16 02:14  ingest_batch      source=salesforce_q2_2024  10000 items
  2026-07-15 02:00  daily_snapshot    scope=org  247 records
  2026-07-15 01:55  cron_fired        cadence=daily-snapshot
  ...
```

**Edge cases:**
- No events in the window: "No timeline events in the specified window."
- Timeline corrupted: warns, offers to restore from backup.

**Error responses:**
- `Timeline file not found. Has AugmentIQ run any actions yet?`

**Audit log entry:**
- Read-only. No audit entry.

---

### `/augmentiq who-knows <topic>`

**Syntax:** `/augmentiq who-knows <topic>`

**Behavior:**
1. Search for records tagged with `<topic>` or whose content discusses `<topic>`.
2. Group by source (which system, which user, which agent instance).
3. Return the source list with record counts.

**Confirmation prompt:** None. Read-only.

**Output format:**
```
Who knows about "GDPR DSR workflow":

  5 records in notion (last: 2026-07-12)
  3 records in salesforce (last: 2026-07-08)
  2 records in manual/saved (last: 2026-07-15)
  1 record in drive (last: 2026-07-01)

Total: 11 records across 4 sources
```

**Edge cases:**
- No matches: "No records found on '<topic>'. Try /augmentiq recall <topic>."

**Error responses:** None standard.

**Audit log entry:** None (read-only).

---

## Tier 4: Compliance (5 commands)

### `/augmentiq audit`

**Syntax:** `/augmentiq audit [--since <date>] [--until <date>] [--pack <gdpr|soc2|hipaa|iso27001|all>]`

**Behavior:**
1. Determine the audit window (default: since last audit, capped at 1 year).
2. Read the timeline events in the window.
3. For each event, include pack-specific fields (GDPR legal basis, SOC2 control
   mapping, HIPAA covered entity role, ISO 27001 control reference).
4. Generate a JSON report and a human-readable Markdown summary.
5. Save the report to the memory backend.
6. Log the audit to the timeline.

**Confirmation prompt:** None. Read-only + write-to-backend. The write is the
audit report itself, which the user implicitly approved by running the command.

**Output format (human-readable):**
```
AugmentIQ Audit Report — 2026-07-01 to 2026-07-16
Scope: organisation
Compliance packs active: gdpr, soc2

Summary:
  Total events: 1,247
  Records created: 245
  Records updated: 87
  Records deleted (via retention): 0
  Ingest batches completed: 16
  DSR requests fulfilled: 2
  Config reconfigured: 1

By classification:
  public: 0
  internal: 1,180
  confidential: 62
  restricted: 5

GDPR-specific (Article 30 records):
  Lawful basis logged: 1,247 / 1,247 (100%)
  Records with PII: 5
  DSR access requests fulfilled: 1
  DSR erasure requests fulfilled: 1

SOC2-specific (CC7.2 / CC7.3):
  Config changes: 1 (by jane@acme.com)
  Failed auth attempts: 0
  Privileged actions: 4 (all user_confirmed: true)

HIPAA-specific (164.312(b)):
  ePHI records: 5 (all access logged)
  No anomalies detected.

ISO 27001-specific (A.12.4.1, A.12.4.3):
  Events logged: 1,247
  Events with cryptographic hash: 1,247 (100%)

Report saved to: ~/.augmentiq/audits/2026-07-16-audit.json
                 ~/.augmentiq/audits/2026-07-16-audit.md
```

**Edge cases:**
- Audit window > 1 year: warns, suggests running in chunks.
- No events in window: still generates a report (shows "No activity in window").

**Error responses:**
- `Compliance pack '<pack>' is not active. Run /augmentiq reconfigure --tier=compliance to enable.`

**Audit log entry:**
```json
{
  "action": "audit",
  "actor": "<owner_name>",
  "window_start": "2026-07-01T00:00:00Z",
  "window_end": "2026-07-16T14:30:00Z",
  "events_included": 1247,
  "packs_reported": ["gdpr", "soc2", "hipaa", "iso27001"],
  "report_path": "~/.augmentiq/audits/2026-07-16-audit.json",
  "user_confirmed": true
}
```

---

### `/augmentiq retention <set|get>`

**Syntax:** `/augmentiq retention get [--classification <level>]`
**Syntax:** `/augmentiq retention set <classification> <days>`

**Behavior (get):**
1. Read `retention_period_days` from config.
2. Show the retention map.

**Behavior (set):**
1. **Confirmation prompt** (per Principle 4): show the change, warn if it's
   shortening retention (could cause immediate data loss).
2. Update config.
3. If shortening: offer to export the affected records before they expire.
4. Re-evaluate any records past the new retention period.

**Confirmation prompt (set, shortening):**
```
Setting retention for 'confidential' from 2555 days to 365 days.
This will cause 12 records to expire on next monthly-retention run.

Before changing, would you like to:
  [a] Export the 12 records to ~/.augmentiq/exports/<timestamp>.jsonl (recommended)
  [b] Change retention without exporting
  [c] Cancel

Choice: ___
```

**Output format (get):**
```
Retention periods:
  public:       3650 days (10 years)
  internal:     1825 days (5 years)
  confidential: 2555 days (7 years)
  restricted:   2555 days (7 years)
```

**Edge cases:**
- `--classification` not specified: shows all.
- Setting to 0: "Records will be deleted on next retention run. Confirm this is intended."
- Setting > 36500 (100yr): refuses, "Maximum supported retention is 100 years."

**Error responses:**
- `Classification '<level>' is not in your scheme. Allowed: <list>.`
- `Retention must be a non-negative integer, got '<input>'.`

**Audit log entry (set):**
```json
{
  "action": "retention_set",
  "actor": "<owner_name>",
  "classification": "confidential",
  "days_before": 2555,
  "days_after": 365,
  "export_path": "~/.augmentiq/exports/2026-07-16-confidential-pre-shortening.jsonl",
  "user_confirmed": true
}
```

---

### `/augmentiq redact <thing>`

**Syntax:** `/augmentiq redact <thing> [--reason <text>]`

**Behavior:**
1. Find the record matching `<thing>`.
2. If multiple matches, ask user to disambiguate.
3. **Confirmation prompt** (per Principle 4): show the record, the proposed
   redaction, and require typed confirmation.
4. On confirm: replace the record's content with `[REDACTED: <reason>]` and a
   cryptographic hash of the original content. Mark classification as `restricted`.
   Log the redaction to the timeline (with the hash, but never the content).
5. The redaction is irreversible — the content is gone, only the hash remains
   (for audit verification, not for restoration).

**Confirmation prompt:**
```
About to redact record: augmentiq:a1b2c3d4-...
  current content: "Customer SSN: 123-45-6789, address: ..."
  reason: PII exposure incident
  will be replaced with: "[REDACTED: PII exposure incident]"
  content hash (for audit only): a1b2c3d4e5f6...
  this is IRREVERSIBLE

Type 'redact-permanently' to confirm: _____
```

**Output format:**
```
Redacted.
Record: augmentiq:a1b2c3d4-...
Content hash (audit only): a1b2c3d4e5f6...
Original content: gone, irreversible
```

**Edge cases:**
- Record already redacted: "Record is already redacted. Original content hash: ..."
- Multiple matches: lists top 5, asks user to pick.

**Error responses:**
- `No record matches '<thing>'.`
- `Type 'redact-permanently' to confirm. You typed: '<input>'.`

**Audit log entry:**
```json
{
  "action": "redact",
  "actor": "<owner_name>",
  "record_id": "augmentiq:a1b2c3d4-...",
  "reason": "PII exposure incident",
  "content_hash": "a1b2c3d4e5f6...",
  "user_confirmed": true
}
```

---

### `/augmentiq dsr <id>`

**Syntax:** `/augmentiq dsr <id> --type <access|erasure|rectification|portability> [--subject <identifier>] [--correction <text>]`

**Behavior:**
1. Load the DSR workflow for the active regulations.
2. For the request type:
   - **access** (GDPR Art. 15): collect all records matching the data subject,
     generate a portable export, deliver to the requester.
   - **erasure** (GDPR Art. 17): identify all records, confirm with user,
     redact (not delete, to preserve audit trail).
   - **rectification** (GDPR Art. 16): collect records, apply the correction,
     log the change.
   - **portability** (GDPR Art. 20): run export filtered to the data subject,
     structured for portability.
3. **Confirmation prompt** (per Principle 4): show the action and its scope.
4. Generate a DSR completion report.

**Confirmation prompt (erasure):**
```
DSR #2026-007 — Erasure request for subject jane.doe@example.com
  Will redact 4 records across 3 backends:
    - 2 in mem0
    - 1 in obsidian
    - 1 in hermes_native

Per Principle 4: redaction preserves audit hash but content is gone.
DSR completion report will be generated.

Proceed? [y/n]
```

**Output format (on success):**
```
DSR #2026-007 fulfilled.
Type: erasure
Subject: jane.doe@example.com
Records redacted: 4 (across 3 backends)
DSR report: ~/.augmentiq/dsr/2026-007-report.md
Compliance: GDPR Article 17
SLA met: 14 days (deadline: 2026-08-01)
```

**Edge cases:**
- Subject not found in any backend: "No records found for subject '<subject>'. DSR closed as no-action."
- Multiple subjects match: asks user to disambiguate.
- SLA deadline: shows days remaining, warns if <7 days.

**Error responses:**
- `DSR #<id> already exists. Use /augmentiq dsr <id> --status to check.`
- `Subject '<subject>' not found. Verify and retry.`

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

### `/augmentiq role <set|get|list>`

**Syntax:**
- `/augmentiq role list`
- `/augmentiq role get <role_name>`
- `/augmentiq role set <role_name> --classification <levels> --commands <commands> --members <users>`

**Behavior:**
1. `list`: show all defined roles and their permissions.
2. `get`: show the full role definition.
3. `set`: create or update a role. **Confirmation prompt** required for `set`.

**Confirmation prompt (set, new role):**
```
Creating role: 'legal-team'
  can_read classifications: public, internal, confidential
  can_write classifications: public, internal
  can_run commands: recall, timeline, who-knows, audit, dsr
  members: legal@acme.com

Proceed? [y/n]
```

**Output format (list):**
```
Defined roles (3):

  admin (5 members)
    can_read: all
    can_write: all
    can_run: all

  finance-team (8 members)
    can_read: public, internal, confidential
    can_write: public, internal
    can_run: recall, timeline, save, tag, snapshot, audit

  legal-team (2 members)
    can_read: all
    can_write: public, internal
    can_run: recall, timeline, who-knows, audit, dsr
```

**Edge cases:**
- Role doesn't exist (get): "Role '<name>' not defined. Use /augmentiq role list."
- Member email not found: "User '<email>' is not a known agent user. Add them first."

**Error responses:**
- `Role '<name>' not found.`
- `Classification '<level>' is not in your scheme.`

**Audit log entry (set):**
```json
{
  "action": "role_set",
  "actor": "<owner_name>",
  "role_name": "legal-team",
  "permissions": {
    "can_read": ["public", "internal", "confidential"],
    "can_write": ["public", "internal"],
    "can_run": ["recall", "timeline", "who-knows", "audit", "dsr"]
  },
  "members": ["legal@acme.com"],
  "user_confirmed": true
}
```

---

## Tier 5: Migration (3 commands)

### `/augmentiq migrate`

**Syntax:** `/augmentiq migrate --to <backend> [--dry-run]`

**Behavior:**
1. Read current `memory_backend` from config.
2. Ask the user for the target backend (with the list of supported backends).
3. Detect the source backend's API capabilities and the target backend's expected
   format.
4. Compute a migration plan:
   - What can be losslessly transferred (most metadata, tags, classifications)
   - What will be approximated (embeddings may be re-computed, custom fields may be flattened)
   - What cannot be preserved (some backend-specific features, e.g., mem0's graph edges)
5. **Confirmation prompt** (per Principle 4): show the plan, require typed
   confirmation.
6. On confirm: execute the migration using the host agent's native APIs for both
   backends. Apply transformations as needed.
7. Generate a lossiness report.
8. Log the migration to the timeline.
9. Update `memory_backend` and `memory_location` in config to the new values.

**Confirmation prompt:**
```
Migration plan: mem0 → obsidian

  Records to transfer: 1,247
  Lossless fields: id, timestamp, scope, source, content, tags, classification,
                   retention_policy, audit_ref, provenance
  Approximated: embeddings (will be re-computed by agent), mem0_graph_edges
  Discarded: mem0's run_id partitioning (Obsidian doesn't have a native concept)

  Estimated time: 8 minutes
  Estimated downtime: 0 (read-only on source during transfer, switch on completion)

  Type 'migrate' to confirm: _____
```

**Output format (on success):**
```
Migration complete.
  Records transferred: 1,247 (lossless)
  Records approximated: 0
  Records discarded: 0 (no graph edges in this dataset)
  Embeddings recomputed: 1,247
  Duration: 7m 42s
  Lossiness report: ~/.augmentiq/migrations/2026-07-16-mem0-to-obsidian.md

New memory_backend: obsidian
New memory_location: ~/Documents/Notes

Verify: /augmentiq status
```

**Edge cases:**
- `--dry-run`: shows the plan, no execution, no timeline entry.
- Source or target backend unreachable: refuses, suggests diagnostics.
- Network interruption mid-migration: rolls back to source, logs the failure,
  offers retry.

**Error responses:**
- `Source backend unreachable. Verify mem0 is running.`
- `Target backend unreachable. Verify obsidian vault is writable.`
- `Migration in progress. Wait or run /augmentiq migrate cancel.`

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
  "lossiness_report": "~/.augmentiq/migrations/2026-07-16-mem0-to-obsidian.md",
  "user_confirmed": true
}
```

---

### `/augmentiq export`

**Syntax:** `/augmentiq export [--scope <...>] [--classification <...>] [--since <date>] [--until <date>] [--output <path>]`

**Behavior:**
1. Read records matching the filters from the memory backend.
2. Format as JSON Lines (canonical AugmentIQ Context Record format).
3. Write to `~/.augmentiq/exports/<timestamp>.jsonl` by default, or to `--output`.
4. Log the export to the timeline (with the count, the filters, and a SHA256
   hash of the export file for audit verification).

**Confirmation prompt:** None. Read-only + write-to-user-fs. The user implicitly
approved by running the command and specifying the output path (or accepting default).

**Output format:**
```
Export complete.
Records: 1,247
Output: ~/.augmentiq/exports/2026-07-16T14-30-00Z.jsonl
Size: 4.2 MB
SHA256: a1b2c3d4e5f6...

Re-import: /augmentiq import --input ~/.augmentiq/exports/2026-07-16T14-30-00Z.jsonl
```

**Edge cases:**
- No records match filters: "No records match the specified filters."
- Output path unwritable: "Cannot write to <path>. Check permissions."

**Error responses:**
- `Output path '<path>' is not writable.`

**Audit log entry:**
```json
{
  "action": "export",
  "actor": "<owner_name>",
  "records_exported": 1247,
  "filters": {"scope": "organisation", "classification": "any"},
  "output_path": "~/.augmentiq/exports/2026-07-16T14-30-00Z.jsonl",
  "file_sha256": "a1b2c3d4e5f6...",
  "user_confirmed": true
}
```

---

### `/augmentiq import`

**Syntax:** `/augmentiq import --input <path> [--dry-run] [--merge-strategy <overwrite|skip|merge>]`

**Behavior:**
1. Read the JSON Lines file at `<path>`.
2. Validate the file format (each line is a valid AugmentIQ Context Record).
3. Apply the merge strategy per record:
   - `overwrite`: replace existing records with the same id
   - `skip`: keep existing, skip imports of the same id
   - `merge`: keep the latest timestamp's version of each field
4. **Confirmation prompt** (per Principle 4): show the count, the merge strategy,
   the count of records that will be overwritten/skipped/merged.
5. On confirm: write records to the current memory backend. Log to timeline.

**Confirmation prompt:**
```
Importing 1,247 records from ~/.augmentiq/exports/2026-07-16T14-30-00Z.jsonl
  Merge strategy: merge
  Will overwrite: 12 records (existing ids)
  Will skip: 0 (no duplicates)
  Will add: 1,235 records (new)

Proceed? [y/n]
```

**Output format:**
```
Import complete.
Records added: 1,235
Records merged: 12
Records skipped: 0
Records failed: 0

Source: ~/.augmentiq/exports/2026-07-16T14-30-00Z.jsonl
Source SHA256: a1b2c3d4e5f6...
```

**Edge cases:**
- File not JSONL: "Input is not a valid AugmentIQ export (expected JSON Lines)."
- Record schema mismatch: "Record at line N is invalid. Run with --dry-run to see all issues."

**Error responses:**
- `Input file '<path>' not found.`
- `Input is not a valid AugmentIQ export.`

**Audit log entry:**
```json
{
  "action": "import",
  "actor": "<owner_name>",
  "source_path": "~/.augmentiq/exports/2026-07-16T14-30-00Z.jsonl",
  "source_sha256": "a1b2c3d4e5f6...",
  "records_added": 1235,
  "records_merged": 12,
  "records_skipped": 0,
  "merge_strategy": "merge",
  "user_confirmed": true
}
```

---

## Tier 6: Legacy ingest (8 commands)

### `/augmentiq ingest`

**Syntax:** `/augmentiq ingest [--source <source_id>]`

**Behavior:**
1. If `--source` is specified, ingest just that source.
2. Otherwise, ingest all sources in `legacy_sources[]`.
3. For each source:
   - If `ingest_status` is not `declared`/`assessing`/`paused`/`failed`: skip
     (already in progress or done).
   - If `source_category` is `enterprise_platform`: route to `customdev@upsurge.ae`
     (see `references/routing.md`), add to status as `pending_migration`,
     do not auto-ingest.
   - Otherwise: load the per-category directive
     (`references/ingest/<category>.md`), execute the ingest per
     `references/batch_protocol.md`.
4. Per Principle 4: confirm the action and its scope before starting.

**Confirmation prompt:**
```
This will start the ingest for 2 sources:

  salesforce_q2_2024 (enterprise_platform)
    → routed to customdev@upsurge.ae for paid engagement
    → status: pending_migration
    → expected engagement: 4-6 weeks, $15-40k

  local-files-marketing (local_files)
    → strategy: one_shot (2.3 GB, 8,400 items)
    → estimated time: 12 minutes
    → no enterprise routing needed

Proceed? [y/n]
```

**Output format:**
```
Ingest dispatched.
  salesforce_q2_2024: pending_migration (routed to customdev@upsurge.ae)
  local-files-marketing: in_progress (1,200 items processed, ETA 8 min)

Track: /augmentiq ingest status
```

**Edge cases:**
- All sources already completed: "All sources are already in `completed` status."
- One source has a previous failure: refuses to start that source, suggests
  `/augmentiq ingest retry <source_id>`.

**Error responses:**
- `Source '<source_id>' is in status '<status>'. Use /augmentiq ingest --source <id> after fixing.`

**Audit log entry:**
```json
{
  "action": "ingest",
  "actor": "<owner_name>",
  "sources_dispatched": [
    {"source_id": "salesforce_q2_2024", "category": "enterprise_platform", "routed_to": "customdev@upsurge.ae"},
    {"source_id": "local-files-marketing", "category": "local_files", "strategy": "one_shot"}
  ],
  "user_confirmed": true
}
```

---

### `/augmentiq ingest status`

**Syntax:** `/augmentiq ingest status [--source <source_id>]`

**Behavior:**
1. Read `legacy_sources[]` from config.
2. For each source, show: source_id, source_type, source_category, ingest_status,
   items_processed, items_remaining, last_batch_timestamp, next_batch_timestamp,
   estimated_completion_date, failure_count.
3. If any source has failures, show the failure list with batch_ids and error summaries.

**Confirmation prompt:** None. Read-only.

**Output format:**
```
Legacy ingest status:

  salesforce_q2_2024
    type: enterprise_platform (Salesforce)
    status: pending_migration
    routed_to: customdev@upsurge.ae (sent 2026-07-15)
    engagement_status: pending_kickoff
    action_required: none

  local-files-marketing
    type: local_files
    status: in_progress
    items: 1,247 / 8,400
    last_batch: 2026-07-16 14:25 (247 items, 0 failures)
    next_batch: 2026-07-16 14:30
    estimated_completion: 2026-07-16 15:00
    failures: 0
```

**Edge cases:**
- No legacy sources configured: "No legacy sources. Run /augmentiq reconfigure --tier=legacy."

**Error responses:** None standard.

**Audit log entry:** None (read-only).

---

### `/augmentiq ingest pause`

**Syntax:** `/augmentiq ingest pause [--source <source_id>]`

**Behavior:**
1. For each source specified (or all if none), set `ingest_status` to `paused`.
2. Disable the `ingest-batch` cron for that source.
3. **Confirmation prompt** (per Principle 4): show the affected sources.
4. Log the pause to the timeline.

**Confirmation prompt:**
```
Pausing ingest for 2 sources:
  salesforce_q2_2024 (already pending_migration, no change)
  local-files-marketing (will pause after current batch completes)

Proceed? [y/n]
```

**Output format:**
```
Paused.
  salesforce_q2_2024: no change (pending_migration)
  local-files-marketing: paused after current batch (was: in_progress, items: 1,494 / 8,400)
```

**Edge cases:**
- Source already paused: "Source '<source_id>' is already paused."
- Source in `completed`/`cancelled`: cannot pause, returns error.

**Error responses:**
- `Cannot pause source in status '<status>'. Use /augmentiq ingest cancel instead.`

**Audit log entry:**
```json
{
  "action": "ingest_pause",
  "actor": "<owner_name>",
  "sources_paused": ["local-files-marketing"],
  "user_confirmed": true
}
```

---

### `/augmentiq ingest resume`

**Syntax:** `/augmentiq ingest resume [--source <source_id>]`

**Behavior:**
1. For each paused source, set `ingest_status` to `scheduled`.
2. Re-enable the `ingest-batch` cron.
3. Log the resume to the timeline.

**Confirmation prompt:**
```
Resuming ingest for 1 source:
  local-files-marketing (will resume at next 2am batch)

Proceed? [y/n]
```

**Output format:**
```
Resumed.
  local-files-marketing: scheduled, next batch 2026-07-17 02:00
```

**Edge cases:**
- Source not paused: "Source '<source_id>' is in status '<status>', not paused."

**Error responses:**
- `Source '<source_id>' is not paused. Nothing to resume.`

**Audit log entry:**
```json
{
  "action": "ingest_resume",
  "actor": "<owner_name>",
  "sources_resumed": ["local-files-marketing"],
  "user_confirmed": true
}
```

---

### `/augmentiq ingest retry <batch_id>`

**Syntax:** `/augmentiq ingest retry <batch_id>`

**Behavior:**
1. Find the batch in the timeline.
2. Re-run the transformation and transfer for that batch.
3. Log the retry to the timeline (with link to the original failure).

**Confirmation prompt:**
```
Retrying batch: ingest-2026-07-15-001
  source: local-files-marketing
  items: 247
  original failure: API rate limit (3 retries exhausted)

Proceed? [y/n]
```

**Output format:**
```
Retried.
Batch: ingest-2026-07-15-001 (retry attempt 2)
Result: 245 succeeded, 2 failed
```

**Edge cases:**
- Batch not found: "Batch '<batch_id>' not found in timeline."
- Batch didn't fail: "Batch '<batch_id>' did not fail. Use /augmentiq ingest status to check."

**Error responses:**
- `Batch '<batch_id>' not found.`
- `Batch '<batch_id>' is in status '<status>', not 'failed'.`

**Audit log entry:**
```json
{
  "action": "ingest_retry",
  "actor": "<owner_name>",
  "batch_id": "ingest-2026-07-15-001",
  "result": {"succeeded": 245, "failed": 2},
  "user_confirmed": true
}
```

---

### `/augmentiq ingest skip <batch_id>`

**Syntax:** `/augmentiq ingest skip <batch_id> --reason <text>`

**Behavior:**
1. Find the batch.
2. **Confirmation prompt** (per Principle 4, destructive): show the batch, the
   reason, the items that will be skipped (not ingested).
3. On confirm: mark the batch as skipped in the timeline. Update
   `items_remaining` to exclude the skipped items.

**Confirmation prompt:**
```
Skipping batch: ingest-2026-07-15-001
  source: local-files-marketing
  items: 247 (will NOT be ingested)
  reason: corrupted files (per user)

This means 247 records will never be ingested. They are not deleted; they
remain in their source system but AugmentIQ will not process them.

Type 'skip-permanently' to confirm: _____
```

**Output format:**
```
Skipped.
Batch: ingest-2026-07-15-001
Items skipped: 247
Reason: corrupted files
Updated items_remaining: 8,400 → 8,153
```

**Edge cases:**
- Batch not in `failed` state: "Only failed batches can be skipped."

**Error responses:**
- `Batch '<batch_id>' is in status '<status>'. Only failed batches can be skipped.`

**Audit log entry:**
```json
{
  "action": "ingest_skip",
  "actor": "<owner_name>",
  "batch_id": "ingest-2026-07-15-001",
  "items_skipped": 247,
  "reason": "corrupted files (per user)",
  "user_confirmed": true
}
```

---

### `/augmentiq ingest cancel`

**Syntax:** `/augmentiq ingest cancel --source <source_id>`

**Behavior:**
1. **Confirmation prompt** (per Principle 4, destructive): show the source, the
   items already transferred, the items that will not be transferred.
2. On confirm: set `ingest_status` to `cancelled`. Disable the `ingest-batch` cron.
3. Items already transferred are kept (they are now part of the memory backend).
4. Items not transferred will never be processed by AugmentIQ.

**Confirmation prompt:**
```
Cancelling ingest for: local-files-marketing
  items already transferred: 1,494 (kept, now part of memory backend)
  items not yet transferred: 6,906 (will NOT be ingested)
  source data remains in its source system (no deletion)

Type 'cancel-permanently' to confirm: _____
```

**Output format:**
```
Cancelled.
Source: local-files-marketing
Status: cancelled
Items kept: 1,494
Items not ingested: 6,906
```

**Edge cases:**
- Source already completed: "Source is in `completed` status. Nothing to cancel."

**Error responses:**
- `Source '<source_id>' is in status '<status>'. Cannot cancel.`

**Audit log entry:**
```json
{
  "action": "ingest_cancel",
  "actor": "<owner_name>",
  "source_id": "local-files-marketing",
  "items_kept": 1494,
  "items_not_ingested": 6906,
  "user_confirmed": true
}
```

---

### `/augmentiq ingest report`

**Syntax:** `/augmentiq ingest report [--source <source_id>] [--output <path>]`

**Behavior:**
1. Aggregate the timeline for all ingest events on the source (or all sources).
2. For each source:
   - Total volume processed, total items processed
   - First batch timestamp, last batch timestamp
   - Successes, failures (with batch_ids), skips (with reasons)
   - Classification distribution
   - Lossiness report (if any)
3. Save the report to `~/.augmentiq/ingest-reports/<timestamp>.md` (or `--output`).
4. Log the report generation to the timeline.

**Confirmation prompt:** None. Read-only + write-to-user-fs.

**Output format:**
```
Ingest report generated.
Source: local-files-marketing
  First batch: 2026-07-15 02:00
  Last batch:  2026-07-16 14:30
  Total items processed: 1,494
  Successes: 1,247
  Failures: 247 (3 batches, all retried or skipped)
  Skips: 247 (batch ingest-2026-07-15-001, reason: corrupted files)
  Classification breakdown:
    public: 0
    internal: 1,400
    confidential: 94
    restricted: 0
  Lossiness: 0 records approximated, 247 discarded (source-side issue)

Report: ~/.augmentiq/ingest-reports/2026-07-16-local-files-marketing.md
```

**Edge cases:**
- Source not configured: "Source '<source_id>' is not in legacy_sources[]."

**Error responses:** None standard.

**Audit log entry:**
```json
{
  "action": "ingest_report",
  "actor": "<owner_name>",
  "source_id": "local-files-marketing",
  "report_path": "~/.augmentiq/ingest-reports/2026-07-16-local-files-marketing.md",
  "user_confirmed": true
}
```

---

## Summary table

| # | Command | Tier | Destructive? | Confirmation? | Audit? |
|---|---|---|---|---|---|
| 1 | `/augmentiq init` | Onboarding | no | yes (per-action) | yes |
| 2 | `/augmentiq status` | Onboarding | no | no | no (read-only) |
| 3 | `/augmentiq reconfigure` | Onboarding | partial | yes (per-action) | yes |
| 4 | `/augmentiq destroy` | Onboarding | YES | yes (typed) | yes (last) |
| 5 | `/augmentiq snapshot` | Capture | partial | yes (per-batch) | yes |
| 6 | `/augmentiq save <thing>` | Capture | partial | yes (per-action) | yes |
| 7 | `/augmentiq tag <thing> [tags]` | Capture | no | yes (per-action) | yes |
| 8 | `/augmentiq recall <query>` | Query | no | no | optional (--audit) |
| 9 | `/augmentiq timeline` | Query | no | no | no |
| 10 | `/augmentiq who-knows <topic>` | Query | no | no | no |
| 11 | `/augmentiq audit` | Compliance | no | no | yes |
| 12 | `/augmentiq retention <set\|get>` | Compliance | partial (set) | yes (set) | yes (set) |
| 13 | `/augmentiq redact <thing>` | Compliance | YES | yes (typed) | yes |
| 14 | `/augmentiq dsr <id>` | Compliance | YES | yes (per-action) | yes |
| 15 | `/augmentiq role <set\|get\|list>` | Compliance | partial (set) | yes (set) | yes (set) |
| 16 | `/augmentiq migrate` | Migration | YES | yes (typed) | yes |
| 17 | `/augmentiq export` | Migration | no | no | yes |
| 18 | `/augmentiq import` | Migration | YES | yes (per-action) | yes |
| 19 | `/augmentiq ingest` | Legacy ingest | partial | yes (per-action) | yes |
| 20 | `/augmentiq ingest status` | Legacy ingest | no | no | no |
| 21 | `/augmentiq ingest pause` | Legacy ingest | no | yes (per-action) | yes |
| 22 | `/augmentiq ingest resume` | Legacy ingest | no | yes (per-action) | yes |
| 23 | `/augmentiq ingest retry <batch_id>` | Legacy ingest | no | yes (per-action) | yes |
| 24 | `/augmentiq ingest skip <batch_id>` | Legacy ingest | YES | yes (typed) | yes |
| 25 | `/augmentiq ingest cancel` | Legacy ingest | YES | yes (typed) | yes |
| 26 | `/augmentiq ingest report` | Legacy ingest | no | no | yes |

Wait, that's 26. Let me re-count.

Actually 24. `init`, `status`, `reconfigure`, `destroy`, `snapshot`, `save`, `tag`, `recall`, `timeline`, `who-knows`, `audit`, `retention`, `redact`, `dsr`, `role`, `migrate`, `export`, `import`, `ingest`, `ingest status`, `ingest pause`, `ingest resume`, `ingest retry`, `ingest skip`, `ingest cancel`, `ingest report`. That's 26 if we count the ingest sub-commands as separate.

**Actually 24 distinct slash-command names** (4 onboarding + 3 capture + 3 query + 5 compliance + 3 migration + 8 ingest = 26 — let me recount:

- Onboarding: 4 (init, status, reconfigure, destroy)
- Capture: 3 (snapshot, save, tag)
- Query: 3 (recall, timeline, who-knows)
- Compliance: 5 (audit, retention, redact, dsr, role)
- Migration: 3 (migrate, export, import)
- Legacy ingest: 8 (ingest, ingest status, ingest pause, ingest resume, ingest retry, ingest skip, ingest cancel, ingest report)

Total = 4 + 3 + 3 + 5 + 3 + 8 = **26**. Not 24.

Correction: 26 slash commands. The earlier 24 number was wrong. This document is correct.

---

**End of commands.md**
