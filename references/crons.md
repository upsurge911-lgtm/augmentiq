# The 6 Cron Cadences

---
## The 6 canonical cadences

### 1. `daily-snapshot`

**What it does:** Captures the current state of all designated sources for the
user's scope. Equivalent to running `/augmentiq snapshot` on schedule.

**Default schedule:** 02:00 local time, every day.

**Schedule derivation by `unit_type`:**
- `individual`: weekly (Sunday 02:00) — the user is unlikely to generate enough
  daily volume to warrant daily snapshots
- `team`: daily (02:00) — team activity is meaningful at daily granularity
- `department` / `organisation`: daily (02:00) — same as team, but the volume is
  higher; the default batch size scales

**Configurable:** yes. User can override via `/augmentiq reconfigure --tier=cadence`.

**Inputs:** the scope and the list of designated sources from `config.yaml`.

**Outputs:**
- A set of AugmentIQ Context Records written to the memory backend
- A timeline entry with batch_id, scope, items_written, items_failed,
  classification_breakdown

**Per Principle 4:** even though it's scheduled, the daily-snapshot *queues a
confirmation prompt* for the user's next active session. If the user is not
active, the cron pauses. The records are written only after the user confirms
in-session.

**Failure modes:**
- Memory backend unreachable: cron is marked failed, timeline entry written,
  user alerted on next session.
- Source unreachable: same.
- User doesn't confirm within 7 days: cron is auto-disabled, user alerted.

---

### 2. `weekly-review`

**What it does:** Surfaces what changed in the past 7 days. Lists new records,
stale items (not accessed in 30+ days), items needing attention (low classification
on high-traffic records, conflicting tags, etc.). Generates a weekly digest.

**Default schedule:** Monday 09:00 local time.

**Schedule derivation by `unit_type`:**
- `individual`: weekly (Monday 09:00) — user benefits from a weekly review
- `team`: weekly (Monday 09:00) — team lead benefits
- `department` / `organisation`: weekly (Monday 09:00) — department head benefits

**Configurable:** yes.

**Inputs:** the timeline for the past 7 days, the record store.

**Outputs:**
- A weekly digest (Markdown) saved to the memory backend
- A timeline entry with the digest's path and a summary of what was found
- Optional: a notification webhook to `integration_webhooks[]` (if configured)

**Per Principle 4:** the digest is a *read-only* operation. No confirmation
required. The user can review it whenever.

**Failure modes:**
- Timeline unreadable: cron is marked failed, user alerted.
- Memory backend slow: cron takes longer than expected but does not time out
  (10-min soft timeout, 30-min hard timeout).

---

### 3. `monthly-retention`

**What it does:** Enforces the `retention_period_days` map. For each
classification level, finds records past their retention period. **Per Principle
4: requires in-session confirmation with a summary before any purge.**

**Default schedule:** 1st of each month, 03:00 local time.

**Schedule derivation by `unit_type`:**
- `individual`: monthly (1st, 03:00)
- `team`: monthly (1st, 03:00)
- `department` / `organisation`: monthly (1st, 03:00)

**Configurable:** yes.

**Inputs:** the retention map from `config.yaml`, the record store.

**Outputs:**
- A list of records to be archived or deleted, with classification, timestamps,
  and content hashes
- A confirmation prompt queued for the user's next active session
- On confirm: the records are archived (moved to cold storage) or deleted per policy
- A timeline entry with the action taken (count, classification breakdown)

**Per Principle 4:** **this is the most confirmation-heavy cron.** Bulk
deletions are the highest-risk action AugmentIQ takes. Double confirmation
required. Pre-destroy export offered.

**Failure modes:**
- User doesn't confirm within 14 days: cron is auto-disabled, records remain,
  user alerted. The retention *policy* is unchanged, just the *enforcement* is
  paused until the user re-engages.
- Memory backend write fails mid-deletion: rolls back to the pre-deletion state,
  logs the partial failure, requires user to retry or skip.

---

### 4. `quarterly-audit`

**What it does:** Generates the full audit report for the quarter. Equivalent to
running `/augmentiq audit` on schedule. Produces a JSON + Markdown report,
populates the pack-specific fields (GDPR, SOC2, HIPAA, ISO 27001), saves to
`~/.augmentiq/audits/<timestamp>.{json,md}`.

**Default schedule:** Last day of each quarter, 04:00 local time.

**Schedule derivation by `unit_type`:**
- `individual`: not enabled by default (low value, low signal)
- `team`: not enabled by default
- `department` / `organisation`: quarterly (last day of quarter, 04:00)

**Configurable:** yes.

**Inputs:** the timeline for the quarter, the record store, the active compliance packs.

**Outputs:**
- JSON audit report
- Markdown audit summary
- Timeline entry with the report's path
- Optional: webhook notification to compliance officer (`dpo_contact`)

**Per Principle 4:** read-only + write-to-user-fs. No confirmation required.

**Failure modes:**
- Timeline too large (>1M events in quarter): generates a partial report with
  a note about truncation. User can re-run with a smaller window.
- Compliance pack missing required field: report includes a warning, not a
  failure. The audit is still produced.

---

### 5. `ingest-batch`

**What it does:** Processes one batch of a legacy ingest source. The cron only
runs for sources with `transfer_strategy = nightly_batches`. For `one_shot`
sources, no cron is registered. For `paused` sources, the cron is disabled.

**Default schedule:** 02:00 local time, every day. **Only registered if at least
one source uses `nightly_batches`.**

**Schedule derivation by source config:**
- Source declares `transfer_strategy = nightly_batches` → cron registered
- Source declares `transfer_strategy = one_shot` → no cron, runs at init time
- Source declares `transfer_strategy = paused` → cron disabled
- Source `ingest_status` in `paused|cancelled|completed|failed` → cron disabled

**Inputs:** the legacy source config, the per-category ingest directive
(`references/ingest/<category>.md`).

**Outputs:**
- A batch of records written to the memory backend
- A timeline entry with batch_id, source_id, items_attempted, items_succeeded,
  items_failed, duration_seconds, classification_breakdown, pii_patterns_detected
- Updated `items_processed` and `items_remaining` in the source config
- If `items_remaining == 0`: source `ingest_status` transitions to `completed`

**Per Principle 4:** **each batch requires confirmation if items_attempted > 100.**
Below that threshold, the cron runs autonomously and the user reviews via
`/augmentiq ingest status`. Above 100, the user gets a per-batch confirmation
prompt.

**Failure modes:**
- Auth failure (e.g., Salesforce credentials expired): source is marked
  `auth_failed`, cron disabled for that source, user alerted immediately.
- Rate limit: the agent handles natively (the directive in
  `references/ingest/<category>.md` specifies the rate-limit handling).
  AugmentIQ logs the backoff duration but does not retry within the same batch.
- Transformation failure: items are marked failed, batch continues, summary
  reports the failure list. User can `/augmentiq ingest retry <batch_id>`.

---

### 6. `on-event`

**What it does:** Captures context when specific events fire. Not a time-based
cron — an event-driven trigger. The agent watches for the configured events
(decision, commit, customer_interaction, incident, policy_change, hire, departure,
contract_signed) and invokes the capture flow.

**Default schedule:** not scheduled. Triggered by events.

**Configurable:** yes. `event_triggers[]` in Tier 7 advanced config.

**Inputs:** the event type, the event payload (from the host agent or a webhook).

**Outputs:**
- An AugmentIQ Context Record with the event details, classification, and tags
- A timeline entry with the event type and the record id

**Per Principle 4:** **all on-event captures require in-session confirmation
before being written.** The agent surfaces the event to the user, shows the
proposed record, and asks for confirmation. If the user is not active, the
event is queued for the next session (max 7-day queue, then auto-discarded with
alert).

**Failure modes:**
- Host doesn't expose the event type: AugmentIQ logs the missing event type
  once, then stops trying. User is informed via `/augmentiq status`.
- Webhook unreachable: event is queued and retried on next cron tick. Max
  3 retries, then discarded with alert.

---

## Host detection logic

When the user runs `/augmentiq init`, the agent detects the host and chooses
the cron implementation pattern. The decision is made in the agent, not by
AugmentIQ.

### Hosts with native cron (cron can be registered directly)

| Host | Cron tool | Cron location | Source citation |
|---|---|---|---|
| **Hermes AI** | Hermes native cron scheduler | (per Hermes docs) | Per session context, recommend verifying on user's machine |
| **OpenClaw** | OpenClaw's `cron` tool | registered via OpenClaw's scheduling API | OpenClaw README: "first-class tools — browser, canvas, nodes, **cron**, sessions, and Discord/Slack actions" |
| **Letta Code** | Letta's `Schedules` API | registered via Letta SDK | Letta showcase entry: "Schedules (crons)" |

### Hosts without native cron (need external scheduler)

| Host | Workaround | Source citation |
|---|---|---|
| **Claude Code** | launchd (macOS) or systemd (Linux) wrapper that calls `claude` CLI | Anthropic Claude Code docs: "agentic coding tool that reads your codebase, edits files, runs commands" |
| **OpenAI Codex CLI** | launchd (macOS) or systemd (Linux) wrapper that calls `codex` CLI | OpenAI Codex README: install via npm/brew/curl |
| **Cursor** | launchd (macOS) or systemd (Linux) wrapper, or Cursor's background-agent API | Cursor docs: "AI editor and coding agent" |
| **nanobot** | MCP-based scheduling, or external scheduler | nanobot README: "MCP and MCP-..." (in heavy dev) |

---

## Per-host implementation patterns

The agent emits a host-appropriate configuration for each cron. The patterns
are documented here as guidance for the agent. AugmentIQ does not ship
pre-built templates for every host (the agent generates them at init time), but
we document the patterns so the agent has a reference.

### Pattern: OpenClaw (native cron)

OpenClaw exposes a cron tool that the agent can invoke. The cron is registered
via the OpenClaw scheduling API, which the agent knows natively.

```yaml
# OpenClaw cron registration (agent emits this at /augmentiq init)
augmentiq_crons:
  - name: augmentiq_daily_snapshot
    schedule: "0 2 * * *"
    command: "/augmentiq snapshot --scope=<scope> --auto"
    enabled: true
  - name: augmentiq_weekly_review
    schedule: "0 9 * * 1"
    command: "/augmentiq timeline --since=7d --format=weekly-digest"
    enabled: true
  - name: augmentiq_monthly_retention
    schedule: "0 3 1 * *"
    command: "/augmentiq retention --enforce --confirm-queued"
    enabled: true
  - name: augmentiq_quarterly_audit
    schedule: "0 4 */3 * 6"  # last day of quarter
    command: "/augmentiq audit --auto"
    enabled: <unit_type ∈ {department, organisation}>
  - name: augmentiq_ingest_batch
    schedule: "0 2 * * *"
    command: "/augmentiq ingest run-batch"
    enabled: <at least one source uses nightly_batches>
```

**Source:** OpenClaw README confirms cron is a first-class tool.
**Compatibility:** Tier 1 (validated host).

---

### Pattern: Hermes AI (native cron)

Hermes has a native cron scheduler. The agent invokes it via Hermes's own API.

```yaml
# Hermes cron registration (per Hermes's own config format)
hermes_crons:
  augmentiq_daily_snapshot:
    cron: "0 2 * * *"
    command: "/augmentiq snapshot"
    enabled: true
  augmentiq_weekly_review:
    cron: "0 9 * * 1"
    command: "/augmentiq timeline --digest"
    enabled: true
  augmentiq_monthly_retention:
    cron: "0 3 1 * *"
    command: "/augmentiq retention --enforce"
    enabled: true
  augmentiq_quarterly_audit:
    cron: "0 4 */3 * 6"
    command: "/augmentiq audit"
    enabled: <unit_type ∈ {department, organisation}>
  augmentiq_ingest_batch:
    cron: "0 2 * * *"
    command: "/augmentiq ingest run-batch"
    enabled: <at least one source uses nightly_batches>
```

**Source:** Per session context. **Action item for v0.1:** verify the exact
cron registration syntax on the user's actual Hermes install.
**Compatibility:** Tier 1 (validated host).

---

### Pattern: Claude Code (external scheduler — launchd on macOS)

Claude Code doesn't ship a native cron. We use `launchd` (macOS) or `systemd`
(Linux) to call the `claude` CLI on schedule.

```xml
<!-- ~/Library/LaunchAgents/ai.augmentiq.daily-snapshot.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.augmentiq.daily-snapshot</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/claude</string>
    <string>/augmentiq</string>
    <string>snapshot</string>
    <string>--scope=organisation</string>
    <string>--auto</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>~/.augmentiq/logs/daily-snapshot.log</string>
  <key>StandardErrorPath</key>
  <string>~/.augmentiq/logs/daily-snapshot.err</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
```

Install with: `launchctl load ~/Library/LaunchAgents/ai.augmentiq.daily-snapshot.plist`
Verify with: `launchctl list | grep augmentiq`
Uninstall with: `launchctl unload ~/Library/LaunchAgents/ai.augmentiq.daily-snapshot.plist`

**Source:** launchd is the macOS-native scheduler, standard on all macOS installs.
**Compatibility:** Tier 1 (validated host).

---

### Pattern: OpenAI Codex CLI (external scheduler)

Codex CLI also doesn't ship a native cron. Same launchd/systemd wrapper as
Claude Code, but the `codex` binary instead.

```xml
<!-- ~/Library/LaunchAgents/ai.augmentiq.daily-snapshot.plist (Codex variant) -->
<key>ProgramArguments</key>
<array>
  <string>/usr/local/bin/codex</string>
  <string>/augmentiq</string>
  <string>snapshot</string>
  <string>--scope=organisation</string>
  <string>--auto</string>
</array>
```

**Source:** OpenAI Codex CLI README confirms install via npm/brew/curl.
**Compatibility:** Tier 1 (validated host).

---

### Pattern: Cursor (background-agent API or external scheduler)

Cursor has a background-agent API for scheduled tasks (similar to GitHub
Actions). The agent uses this API for crons where possible, falls back to
launchd/systemd for hosts without the API.

**Compatibility:** Tier 2 (verified format, not yet tested in production with
AugmentIQ).

---

### Pattern: nanobot (MCP-based or external scheduler)

nanobot is MCP-first. The agent can schedule crons via MCP, or fall back to
external scheduler. nanobot is in heavy development per its own README, so
compatibility may shift.

**Source:** nanobot README: "This project is under heavy development."
**Compatibility:** Tier 3 (early, expect breakage).

---

## External scheduler fallbacks

For hosts without native cron, the agent generates a launchd plist (macOS) or
systemd timer (Linux). The user runs a single command to install all crons:

```bash
# macOS — install all AugmentIQ launchd jobs
launchctl load ~/Library/LaunchAgents/ai.augmentiq.*.plist

# Linux — install all AugmentIQ systemd timers
systemctl --user enable augmentiq-*.timer
systemctl --user start augmentiq-*.timer
```

The agent emits the full plist/timer set at `/augmentiq init` time. The user
runs the install command (or the agent can offer to run it with confirmation).

### launchd plist template (per cron)

Provided in `assets/cron-templates/launchd.plist` (the agent substitutes the
schedule, command, and label per cron).

### systemd timer template (per cron)

```ini
# ~/.config/systemd/user/augmentiq-daily-snapshot.timer
[Unit]
Description=AugmentIQ daily snapshot

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```ini
# ~/.config/systemd/user/augmentiq-daily-snapshot.service
[Unit]
Description=AugmentIQ daily snapshot

[Service]
Type=oneshot
ExecStart=/usr/local/bin/claude /augmentiq snapshot --scope=organisation --auto
StandardOutput=file:%h/.augmentiq/logs/daily-snapshot.log
StandardError=file:%h/.augmentiq/logs/daily-snapshot.err
```

**Source:** systemd and launchd are standard on Linux and macOS respectively.
No external citation needed.

---

## Cron install + verify + uninstall

The AugmentIQ agent's `/augmentiq init` flow:

1. Generates the cron set per host (1-5 cron definitions, depending on what
   `unit_type` and `event_triggers[]` enable)
2. Emits the host-specific config files
3. **Confirmation prompt** (per Principle 4): show the user the cron set, ask
   for permission to install
4. On confirm:
   - Native-cron hosts: call the host's scheduling API
   - External-scheduler hosts: write the plist/timer files
5. **Verify** each cron registered (list crons, confirm presence)
6. Log the install to the timeline

The `/augmentiq destroy` flow:

1. Per Principle 4: double confirmation
2. Disable all crons (uninstall from host scheduler or unload from launchd/systemd)
3. Log the uninstall to the timeline

---

## Failure modes (cross-cutting)

These are the things that can go wrong across all 6 cadences:

| Failure | Detection | Response |
|---|---|---|
| Cron doesn't fire | `/augmentiq status` checks last-fire time | Alert user, offer to reinstall |
| Cron fires but agent unreachable | Timeout in scheduler | Log to scheduler's stderr, alert user on next session |
| Cron fires, agent runs, action fails | Timeline entry has `failed` status | Pause subsequent crons of that cadence, alert user |
| Memory backend unreachable | Agent's API call fails | Cron marks failed, retried at next fire, user alerted if 3 consecutive failures |
| User doesn't confirm queued action | 7-day queue timeout | Auto-disable that cron, alert user, retention enforcement paused for records in question |
| Crons conflict (e.g., daily-snapshot and ingest-batch both at 02:00) | Init flow detects overlap | Reschedule to stagger (daily-snapshot at 02:00, ingest-batch at 03:00) |
| User adds/removes compliance pack after init | Reconfigure detects mismatch | Regenerate audit cron, alert user |

---

## The on-disk representation

Crons are tracked in `~/.augmentiq/crons.yaml`:

```yaml
version: 0.1
host: openclaw
host_cron_capable: true
crons:
  - id: augmentiq_daily_snapshot
    cadence: daily-snapshot
    schedule: "0 2 * * *"
    command: "/augmentiq snapshot --scope=organisation --auto"
    enabled: true
    last_fired: 2026-07-16T02:00:14Z
    last_status: success
    next_fired: 2026-07-17T02:00:00Z
  - id: augmentiq_weekly_review
    cadence: weekly-review
    schedule: "0 9 * * 1"
    command: "/augmentiq timeline --since=7d --format=weekly-digest"
    enabled: true
    last_fired: 2026-07-13T09:00:08Z
    last_status: success
    next_fired: 2026-07-20T09:00:00Z
  - id: augmentiq_monthly_retention
    cadence: monthly-retention
    schedule: "0 3 1 * *"
    command: "/augmentiq retention --enforce"
    enabled: true
    last_fired: 2026-07-01T03:00:22Z
    last_status: success
    next_fired: 2026-08-01T03:00:00Z
  - id: augmentiq_quarterly_audit
    cadence: quarterly-audit
    schedule: "0 4 */3 * 6"
    command: "/augmentiq audit --auto"
    enabled: true
    last_fired: 2026-06-30T04:00:31Z
    last_status: success
    next_fired: 2026-09-30T04:00:00Z
  - id: augmentiq_ingest_batch
    cadence: ingest-batch
    schedule: "0 3 * * *"  # staggered to avoid overlap with daily-snapshot
    command: "/augmentiq ingest run-batch"
    enabled: true
    last_fired: 2026-07-16T03:00:45Z
    last_status: success
    next_fired: 2026-07-17T03:00:00Z
```

The user can edit this file directly (Principle 2: don't own the agent's config).
The agent reads it on every `/augmentiq status` call.

---

## Versioning

The 6 cadences are versioned with the skill:

- **v0.1** — the 6 cadences as documented here.
- **v0.2+** — new cadences can be added (e.g., `hourly_pulse` for very active
  deployments). Never remove a cadence.
- **v1.0+** — cadences are stable, contract-grade. Host-agent integrations cite them.
- **v2.0** — only if a cadence is removed or its semantics change (breaking
  change). Always paired with a migration path.

---

**End of crons.md**
