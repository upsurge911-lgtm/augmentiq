# The 7-Tier Variable Schema

---
## Tier 1 — Identity

Variables that identify the unit AugmentIQ is managing. Always collected.

### `unit_type`

| Property | Value |
|---|---|
| Name | `unit_type` |
| Type | enum |
| Allowed values | `individual`, `team`, `department`, `organisation` |
| Default | (must be asked — no default; the user's first answer) |
| Scope | global |
| Validation | must be one of the 4 allowed values |
| Source question | "Are you setting up AugmentIQ for an individual, a team, a department, or an organisation?" |
| Derives | which questionnaire block is loaded next, which scale references are loaded, which compliance questions appear |

### `unit_name`

| Property | Value |
|---|---|
| Name | `unit_name` |
| Type | string |
| Default | "Unnamed Unit" (only used if user explicitly skips) |
| Scope | global |
| Validation | non-empty, ≤100 chars |
| Source question | "What's the name of this unit? (e.g., 'Sales team', 'Finance department', 'Acme Corp', or your own name)" |

### `owner_name`

| Property | Value |
|---|---|
| Name | `owner_name` |
| Type | string |
| Default | (must be asked) |
| Scope | global |
| Validation | non-empty, ≤100 chars |
| Source question | "Who's the primary contact / owner for this AugmentIQ setup?" |
| Used by | the timeline (every state change is attributed to `owner_name` unless overridden per-action) |

### `owner_contact`

| Property | Value |
|---|---|
| Name | `owner_contact` |
| Type | string |
| Default | (must be asked) |
| Scope | global |
| Validation | must be a valid email OR a contact reference (e.g., "@username in Slack") |
| Source question | "Best contact for the owner? (email or a known platform handle)" |
| Used by | DSR notifications, breach notifications, scheduled-action failures |

---

## Tier 2 — Host environment

Variables that describe the agent + machine AugmentIQ is running on. The agent
auto-detects most of these from filesystem markers and version probes; the user
confirms.

### `host_agent`

| Property | Value |
|---|---|
| Name | `host_agent` |
| Type | enum |
| Allowed values | `hermes`, `openclaw`, `claude_code`, `codex`, `cursor`, `nanobot`, `letta_code`, `custom` |
| Default | (auto-detected, must be confirmed) |
| Scope | global |
| Validation | must be in the allowed list or a custom entry approved by the user |
| Detection logic | check for filesystem markers: `~/.hermes/`, `~/.openclaw/`, `~/.claude/`, `~/.codex/`, `~/.cursor/`, `~/.nanobot/`, `~/.letta/` |
| Source question | (only asked if detection fails) "Which agent are you running? Options: Hermes, OpenClaw, Claude Code, Codex, Cursor, nanobot, Letta Code, or other" |
| Used by | cron template selection, slash command convention, file system access paths |

### `host_agent_version`

| Property | Value |
|---|---|
| Name | `host_agent_version` |
| Type | string (semver) |
| Default | (auto-detected) |
| Scope | global |
| Validation | non-empty |
| Detection logic | run `<agent> --version` if available, otherwise read from `~/.openclaw/VERSION` or equivalent |
| Used by | compatibility checks (some commands require agent ≥ specific version) |

### `host_os`

| Property | Value |
|---|---|
| Name | `host_os` |
| Type | enum |
| Allowed values | `macos`, `linux`, `windows`, `container` |
| Default | (auto-detected via `process.platform`) |
| Scope | global |
| Validation | must be in allowed list |
| Detection logic | `process.platform === 'darwin'` → macos, `'linux'` → linux, `'win32'` → windows, container markers (e.g., `/.dockerenv`) → container |
| Used by | cron asset selection (launchd vs systemd), install paths |

### `host_cron_capable`

| Property | Value |
|---|---|
| Name | `host_cron_capable` |
| Type | boolean |
| Default | (auto-detected) |
| Scope | global |
| Validation | true / false |
| Detection logic | host_agent in `{hermes, openclaw, letta_code}` → true; in `{claude_code, codex, cursor, nanobot}` → false |
| Used by | cron install path (native cron vs external scheduler) |

### `deployment_location`

| Property | Value |
|---|---|
| Name | `deployment_location` |
| Type | enum |
| Allowed values | `local`, `vps`, `on_prem`, `private_cloud` |
| Default | derived: `local` if `host_os in {macos, linux, windows}` and no container marker; `vps` if a remote shell is detected; otherwise asked |
| Scope | global |
| Validation | must be in allowed list |
| Source question | (only if not auto-detectable) "Where is the agent running? (this Mac, a VPS, on-prem, a private cloud)" |
| Used by | compliance pack (some regulations require data residency), backup strategy |

---

## Tier 3 — Memory backend

Variables that describe where the agent's memory lives. The user provides the
backend type and location; the agent confirms it can read/write.

### `memory_backend`

| Property | Value |
|---|---|
| Name | `memory_backend` |
| Type | enum |
| Allowed values | `obsidian`, `hermes_native`, `mem0`, `reme`, `custom` |
| Default | (must be asked on first run; remembered on subsequent runs) |
| Scope | global |
| Validation | must be in allowed list |
| Source question | "Which memory backend are you using? (Obsidian, Hermes native MEMORY.md, mem0, ReMe, or custom)" |
| Used by | backend reference loading, record transformation rules |

### `memory_location`

| Property | Value |
|---|---|
| Name | `memory_location` |
| Type | string (path or URL) |
| Default | (auto-detected per backend) |
| Scope | global |
| Validation | depends on backend: filesystem path for `obsidian`, `hermes_native`; URL for `mem0`, `reme`; module path for `custom` |
| Detection logic | for Obsidian: scan `~/Documents/` for `.obsidian` folder; for Hermes: read `~/.hermes/`; for cloud backends: read API key from env, hit `/v1/whoami` endpoint |
| Source question | (only if detection fails) "Where is your memory backend located?" |
| Used by | all read/write operations |

### `memory_shared`

| Property | Value |
|---|---|
| Name | `memory_shared` |
| Type | boolean |
| Default | false (if `unit_type = individual`); true (if `unit_type ∈ {team, department, organisation}`) |
| Scope | global |
| Validation | true / false |
| Source question | "Is this memory shared across multiple users? (only if unit_type > individual)" |
| Used by | RBAC configuration, partition strategy, audit log scope |

### `memory_partition_strategy`

| Property | Value |
|---|---|
| Name | `memory_partition_strategy` |
| Type | enum |
| Allowed values | `by_agent`, `by_department`, `by_user`, `global` |
| Default | derived: `by_agent` if `memory_shared` is true and `unit_type` ≥ team; `global` if `memory_shared` is false |
| Scope | global |
| Validation | must be in allowed list |
| Source question | "How should records be partitioned? (per agent instance, per department, per user, or one global namespace)" |
| Used by | record storage layout, recall scope, audit log grouping |

---

## Tier 4 — Historical data

Variables that describe the legacy data the user wants to ingest. Asked in a loop,
once per source.

### `has_legacy_data`

| Property | Value |
|---|---|
| Name | `has_legacy_data` |
| Type | boolean |
| Default | (must be asked) |
| Scope | global |
| Validation | true / false |
| Source question | "Do you have historical data you want to bring into the agent's memory? (yes / no)" |
| Used by | gates the entire Tier 4 loop and the `legacy_*` source-specific questions |

### `legacy_sources[]`

| Property | Value |
|---|---|
| Name | `legacy_sources` |
| Type | list of objects |
| Object shape | `{source_id, source_type, source_category, volume_gb, item_count, oldest_year, classification_default, transfer_strategy, batch_size, ingest_status}` |
| Default | `[]` (empty list) |
| Scope | global |
| Validation | each entry must have all required fields |
| Source question | "Where does the historical data live? (multi-select: local files, cloud storage, standard SaaS, email, enterprise platform)" |
| Used by | legacy ingest flow, estimator, strategy decision tree |

### Per-source variables (loop body, asked once per `legacy_source` entry)

#### `source_id`

| Property | Value |
|---|---|
| Name | `source_id` |
| Type | string (slug) |
| Default | auto-generated from source_type + index, e.g., `salesforce_q2_2024` |
| Scope | per_source |
| Validation | unique within `legacy_sources[]`, ≤64 chars, kebab-case |
| Used by | record provenance, audit log, batch IDs |

#### `source_type`

| Property | Value |
|---|---|
| Name | `source_type` |
| Type | enum |
| Allowed values | `local_files`, `cloud_storage_drive`, `cloud_storage_dropbox`, `cloud_storage_onedrive`, `cloud_storage_icloud`, `standard_saas_notion`, `standard_saas_confluence`, `standard_saas_slack`, `standard_saas_github`, `standard_saas_linear`, `standard_saas_hubspot`, `email_gmail`, `email_outlook`, `email_pst`, `email_mbox`, `enterprise_platform` (and others) |
| Default | (must be selected) |
| Scope | per_source |
| Validation | must be in allowed list |
| Used by | routes to the right per-category ingest directive (local/cloud/saas/email) or to the enterprise routing flow |

#### `source_category`

| Property | Value |
|---|---|
| Name | `source_category` |
| Type | enum |
| Allowed values | `local_files`, `cloud_storage`, `standard_saas`, `email`, `enterprise_platform` |
| Default | derived from `source_type` (e.g., `local_files` → `local_files`, `cloud_storage_drive` → `cloud_storage`, `enterprise_platform` → `enterprise_platform`) |
| Scope | per_source |
| Validation | must be one of the 5 categories |
| Used by | routes the source to agent-native ingest or to `customdev@upsurge.ae` |

#### `volume_gb`

| Property | Value |
|---|---|
| Name | `volume_gb` |
| Type | number (float, ≥0) |
| Default | (must be asked or estimated from item_count) |
| Scope | per_source |
| Validation | ≥0 |
| Source question | "Roughly how much data? (in GB, or leave blank if you only know the item count)" |
| Used by | estimator, strategy decision tree |

#### `item_count`

| Property | Value |
|---|---|
| Name | `item_count` |
| Type | integer (≥0) |
| Default | (must be asked or estimated from volume_gb) |
| Scope | per_source |
| Validation | ≥0 |
| Source question | "How many items? (records, files, emails — or leave blank if you only know the GB)" |
| Used by | estimator, strategy decision tree |

#### `oldest_year`

| Property | Value |
|---|---|
| Name | `oldest_year` |
| Type | integer (4-digit year) |
| Default | (must be asked) |
| Scope | per_source |
| Validation | 1900 ≤ year ≤ current year |
| Source question | "How old is the oldest record? (year)" |
| Used by | retention default derivation, compliance mapping |

#### `classification_default`

| Property | Value |
|---|---|
| Name | `classification_default` |
| Type | enum |
| Allowed values | `public`, `internal`, `confidential`, `restricted` |
| Default | derived: `internal` (most common) for most sources; `confidential` for CRM/HR; `restricted` for PII-heavy sources |
| Scope | per_source |
| Validation | must be in allowed list |
| Source question | "Default classification for records from this source? (public / internal / confidential / restricted)" |
| Used by | record creation, PII auto-upgrade baseline |

#### `transfer_strategy`

| Property | Value |
|---|---|
| Name | `transfer_strategy` |
| Type | enum |
| Allowed values | `one_shot`, `nightly_batches`, `paused` |
| Default | derived from volume: `one_shot` if `volume_gb ≤ 1` AND `item_count ≤ 10000`; `nightly_batches` if `volume_gb ≤ 500` OR `item_count ≤ 1000000`; `paused` otherwise |
| Scope | per_source |
| Validation | must be in allowed list |
| Source question | (only if user wants to override the derived default) "Override the transfer strategy?" |
| Used by | legacy ingest flow, cron registration |

#### `batch_size`

| Property | Value |
|---|---|
| Name | `batch_size` |
| Type | enum |
| Allowed values | `small_100`, `medium_1000`, `large_10000`, `xl_100000` |
| Default | derived from `volume_gb`: `small_100` if ≤5GB, `medium_1000` if ≤50GB, `large_10000` if ≤250GB, `xl_100000` if ≤500GB |
| Scope | per_source |
| Validation | must be in allowed list |
| Source question | (only if user wants to override) "Override the batch size?" |
| Used by | ingest-batch cron configuration |

#### `ingest_status`

| Property | Value |
|---|---|
| Name | `ingest_status` |
| Type | enum |
| Allowed values | `declared`, `assessing`, `estimated`, `confirmed`, `scheduled`, `in_progress`, `paused`, `completed`, `failed`, `cancelled` |
| Default | `declared` |
| Scope | per_source |
| Validation | state machine transitions only (declared → assessing → estimated → confirmed → scheduled → in_progress → completed/paused/cancelled) |
| Set by | legacy ingest flow, never by user |
| Used by | `/augmentiq ingest status` output, batch scheduling |

#### `estimated_completion_date`

| Property | Value |
|---|---|
| Name | `estimated_completion_date` |
| Type | date (ISO 8601) |
| Default | computed from `volume_gb`, `item_count`, `batch_size`, hours_per_night |
| Scope | per_source |
| Validation | valid date in the future |
| Set by | estimator (the formula lives in `references/estimator.md`) |
| Used by | `/augmentiq ingest status`, `init` summary |

---

## Tier 5 — Cadence

Variables that define when and how the crons run. Defaults adapt to `unit_type`.

### `snapshot_cadence`

| Property | Value |
|---|---|
| Name | `snapshot_cadence` |
| Type | enum |
| Allowed values | `realtime`, `daily`, `weekly`, `monthly`, `on_event` |
| Default | derived: `weekly` if `unit_type = individual`; `daily` if `unit_type = team`; `realtime` if `unit_type ∈ {department, organisation}` |
| Scope | global |
| Validation | must be in allowed list |
| Source question | "How often should the agent capture context snapshots? (realtime / daily / weekly / monthly / on-event)" |
| Used by | cron registration, retention default derivation |

### `retention_period_days`

| Property | Value |
|---|---|
| Name | `retention_period_days` |
| Type | integer (≥0) |
| Default | derived per classification: public=3650 (10yr), internal=1825 (5yr), confidential=2555 (7yr), restricted=2555 (7yr). Default if no classification scheme: 365 |
| Scope | per_classification (this is a map, not a scalar — the variable stores one value per classification level) |
| Validation | ≥0, ≤36500 (100yr hard cap) |
| Source question | "How long should records be retained per classification? (defaults are 7yr for confidential+; user can override)" |
| Used by | monthly-retention cron, compliance pack defaults |

### `classification_scheme`

| Property | Value |
|---|---|
| Name | `classification_scheme` |
| Type | enum |
| Allowed values | `none`, `three_tier`, `four_tier`, `custom` |
| Default | derived: `none` if `unit_type = individual`; `three_tier` if `unit_type = team`; `four_tier` if `unit_type ∈ {department, organisation}` |
| Scope | global |
| Validation | must be in allowed list |
| Source question | (only if `unit_type > team`) "What classification scheme? (none / public-internal-confidential / public-internal-confidential-restricted / custom)" |
| Used by | record creation, PII auto-upgrade, retention enforcement, compliance pack mapping |

### `audit_log_retention_days`

| Property | Value |
|---|---|
| Name | `audit_log_retention_days` |
| Type | integer (≥0) |
| Default | derived: 90 if `unit_type = individual`; 365 if `unit_type = team`; 2555 (7yr) if `unit_type = department`; 3650 (10yr) if `unit_type = organisation` |
| Scope | global |
| Validation | ≥0, ≤36500 |
| Source question | "How long should the audit log be retained? (default depends on your scale tier)" |
| Used by | timeline retention enforcement |

---

## Tier 6 — Compliance

Variables for regulated deployments. **Only collected if `unit_type ∈ {department,
organisation}` AND the user opts in to compliance.** Otherwise the entire tier is
skipped (progressive disclosure).

### `regulations[]`

| Property | Value |
|---|---|
| Name | `regulations` |
| Type | list of enums |
| Allowed values | `gdpr`, `soc2`, `hipaa`, `iso27001`, `ccpa`, `pci_dss`, `none` |
| Default | `[]` (empty list, only collected if `unit_type` ≥ department) |
| Scope | global |
| Validation | each value must be in allowed list; if `none` is in the list, it must be the only value |
| Source question | "Which regulations apply? (multi-select: GDPR, SOC2, HIPAA, ISO 27001, CCPA, PCI DSS)" |
| Used by | loads the relevant compliance pack(s) from `references/compliance/` |

### `dpo_contact`

| Property | Value |
|---|---|
| Name | `dpo_contact` |
| Type | string (email or platform handle) |
| Default | (must be asked if `regulations` includes `gdpr` or `hipaa`) |
| Scope | global |
| Validation | non-empty, valid contact format |
| Source question | (only if GDPR or HIPAA enabled) "Who's the Data Protection Officer / Privacy Officer? (name + contact)" |
| Used by | DSR notifications, breach notifications, audit report distribution |

### `breach_notification_sla_hours`

| Property | Value |
|---|---|
| Name | `breach_notification_sla_hours` |
| Type | integer (≥0) |
| Default | 72 (GDPR standard) if `gdpr` enabled; 60 if `hipaa` enabled; 24 if both |
| Scope | global |
| Validation | ≥0, ≤720 (30 days hard cap) |
| Source question | (only if any compliance enabled) "What's your breach notification SLA? (default 72hr per GDPR)" |
| Used by | incident response, audit log alerting |

### `dsr_workflow`

| Property | Value |
|---|---|
| Name | `dsr_workflow` |
| Type | enum |
| Allowed values | `manual`, `semi_automated`, `automated` |
| Default | `semi_automated` (AugmentIQ prepares the export/deletion, user confirms per action) |
| Scope | global |
| Validation | must be in allowed list |
| Source question | (only if `gdpr` enabled) "How automated should DSR fulfillment be? (manual / semi-automated / automated)" |
| Used by | `/augmentiq dsr` command behavior |

---

## Tier 7 — Advanced (opt-in)

Variables for power users and enterprise deployments. **Only collected if the
user opts in** to the "Advanced features" question at the end of the
questionnaire.

### `multi_agent_federation`

| Property | Value |
|---|---|
| Name | `multi_agent_federation` |
| Type | boolean |
| Default | false |
| Scope | global |
| Validation | true / false |
| Source question | (only in Advanced) "Do you want multiple agents to share this AugmentIQ config? (yes = multi-agent federation)" |
| Used by | cross-agent coordination, conflict resolution, lock files |

### `custom_classifications[]`

| Property | Value |
|---|---|
| Name | `custom_classifications` |
| Type | list of strings |
| Default | `[]` |
| Scope | global |
| Validation | each value must be a non-empty string, ≤32 chars |
| Source question | (only if `classification_scheme = custom`) "Define your custom classification levels (e.g., 'public', 'internal', 'internal-restricted', 'confidential-pii', 'top-secret')" |
| Used by | record creation, retention map keys |

### `event_triggers[]`

| Property | Value |
|---|---|
| Name | `event_triggers` |
| Type | list of enums |
| Allowed values | `decision`, `commit`, `customer_interaction`, `incident`, `policy_change`, `hire`, `departure`, `contract_signed` |
| Default | derived: `[]` if `unit_type = individual`; `[decision, commit, customer_interaction]` if `unit_type = team`; all 8 if `unit_type ∈ {department, organisation}` |
| Scope | global |
| Validation | each value must be in allowed list |
| Source question | (only in Advanced, if `unit_type > individual`) "Which on-event captures do you want? (decision / commit / customer_interaction / incident / policy_change / hire / departure / contract_signed)" |
| Used by | on-event capture triggers |

### `integration_webhooks[]`

| Property | Value |
|---|---|
| Name | `integration_webhooks` |
| Type | list of strings (URLs) |
| Default | `[]` |
| Scope | global |
| Validation | each value must be a valid HTTPS URL |
| Source question | (only in Advanced) "Webhook URLs to notify on state changes? (HTTPS only, one per line)" |
| Used by | event delivery, external alerting |

---

## Smart-default derivation (the engine that powers the questionnaire)

The questionnaire doesn't ask 30 questions in a row. It asks 5-7, then computes
smart defaults for the next 5-7, then shows the user the defaults and lets them
override. The derivation table:

| Trigger variable | Derives | Default value | Override prompt |
|---|---|---|---|
| `unit_type = individual` | `memory_shared` | false | (no prompt, just set) |
| `unit_type = team` | `memory_shared` | true | "Is this memory shared across the team?" |
| `unit_type ∈ {department, organisation}` | `memory_shared` | true | "Is this memory shared across the unit?" |
| `unit_type = individual` | `classification_scheme` | `none` | (no prompt) |
| `unit_type = team` | `classification_scheme` | `three_tier` | "Use 3-tier (public/internal/confidential)?" |
| `unit_type ≥ department` | `classification_scheme` | `four_tier` | "Use 4-tier (adds restricted)?" |
| `unit_type = individual` | `snapshot_cadence` | `weekly` | "Weekly snapshots ok?" |
| `unit_type = team` | `snapshot_cadence` | `daily` | "Daily snapshots ok?" |
| `unit_type ≥ department` | `snapshot_cadence` | `realtime` | "Realtime captures ok?" |
| `unit_type = individual` | `audit_log_retention_days` | 90 | "Keep audit log 90 days?" |
| `unit_type = team` | `audit_log_retention_days` | 365 | "Keep audit log 1 year?" |
| `unit_type = department` | `audit_log_retention_days` | 2555 (7yr) | "Keep audit log 7 years?" |
| `unit_type = organisation` | `audit_log_retention_days` | 3650 (10yr) | "Keep audit log 10 years?" |
| `regulations` includes `gdpr` | `dpo_contact` | (must ask) | "Who's the DPO?" |
| `regulations` includes `gdpr` | `breach_notification_sla_hours` | 72 | "Confirm 72hr breach SLA?" |
| `regulations` includes `hipaa` | `breach_notification_sla_hours` | 60 | "Confirm 60-day breach SLA?" |
| `volume_gb ≤ 1` AND `item_count ≤ 10000` | `transfer_strategy` | `one_shot` | "Run in one session?" |
| `volume_gb ≤ 500` AND `item_count ≤ 1000000` | `transfer_strategy` | `nightly_batches` | "Run in nightly batches?" |
| `volume_gb > 500` OR `item_count > 1000000` | `transfer_strategy` | `paused` | "Pause for a paid engagement?" |
| `host_agent ∈ {hermes, openclaw, letta_code}` | `host_cron_capable` | true | (auto-detect) |
| `host_agent ∈ {claude_code, codex, cursor, nanobot}` | `host_cron_capable` | false | (auto-detect) |

The questionnaire shows the derived default and asks "OK or override?" for every
variable. One keystroke to accept, more keystrokes to override. No type-the-value-
from-scratch friction for the common path.

---

## Validation rules (the agent's contract with the user)

When the user provides a value, the agent validates it before persisting:

1. **Type check** — value matches the declared Type. Integer literals, enum
   membership, string format, etc.
2. **Range check** — numeric values are in the allowed range.
3. **Format check** — strings match the expected format (email, URL, ISO date, etc.).
4. **Cross-variable check** — combinations are valid (e.g., `classification_scheme = custom`
   requires `custom_classifications[]` to be non-empty).
5. **Scope check** — per-source variables are stored per source, not globally.

If validation fails, the agent re-prompts with a specific error message, not a
generic "invalid input." The user is told which rule failed and what the allowed
values are.

---

## The on-disk representation

Variables are persisted as YAML at `~/.augmentiq/config.yaml`:

```yaml
version: 0.1
unit_type: organisation
unit_name: Acme Corp Finance
owner_name: Jane Smith
owner_contact: jane@acme.com
host:
  host_agent: openclaw
  host_agent_version: 0.4.2
  host_os: linux
  host_cron_capable: true
  deployment_location: on_prem
memory:
  memory_backend: mem0
  memory_location: https://api.mem0.ai/v1
  memory_shared: true
  memory_partition_strategy: by_department
legacy:
  has_legacy_data: true
  legacy_sources:
    - source_id: salesforce_q2_2024
      source_type: enterprise_platform
      source_category: enterprise_platform
      volume_gb: 320
      item_count: 850000
      oldest_year: 2014
      classification_default: confidential
      transfer_strategy: nightly_batches
      batch_size: large_10000
      ingest_status: scheduled
      estimated_completion_date: 2026-08-15
cadence:
  snapshot_cadence: realtime
  retention_period_days:
    public: 3650
    internal: 1825
    confidential: 2555
    restricted: 2555
  classification_scheme: four_tier
  audit_log_retention_days: 2555
compliance:
  regulations: [gdpr, soc2]
  dpo_contact: dpo@acme.com
  breach_notification_sla_hours: 72
  dsr_workflow: semi_automated
advanced:
  multi_agent_federation: true
  custom_classifications: []
  event_triggers: [decision, commit, customer_interaction, incident, policy_change, hire, departure, contract_signed]
  integration_webhooks:
    - https://hooks.acme.com/augmentiq-events
```

The user can edit this file directly (Principle 2: don't own the agent's config).
The agent reads it on every action. The questionnaire writes to it.

---

## Versioning

The variable schema is versioned with the skill:

- **v0.1** — the 7 tiers, 30+ variables as documented here.
- **v0.2+** — new variables can be added (additive changes, never breaking).
- **v1.0+** — schema is stable, contract-grade. Compliance packs cite it.
- **v2.0** — only if a variable is removed or its type/validation changes
  (breaking change). Always paired with a migration path for existing configs.

---

**End of variables.md**
