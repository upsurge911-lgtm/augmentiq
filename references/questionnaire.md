# The 4 Scale Tiers + Questionnaire UX

---
## The 4 scale tiers

### Tier 1: `individual`

**Who it's for:** a single user setting up AugmentIQ for themselves. Their
memory backend is theirs alone. No team, no compliance, no shared decisions.

**Question count:** 5 universal questions. **0 from Tier 6 (compliance), 0 from
Tier 7 (advanced).**

**What it unlocks:**
- Daily-snapshot cron (weekly default), weekly-review cron, monthly-retention cron
- Full 5-principle governance
- `/augmentiq recall`, `/augmentiq timeline`, `/augmentiq save`, `/augmentiq tag`
- PII auto-classification
- Portable export

**What it does NOT unlock:**
- Compliance packs (no organisational regulations apply)
- Multi-agent federation
- Custom classification schemes (uses `none` by default)
- Quarterly audit cron (low signal for a single user)
- `role` command (single user, no roles)
- Legacy ingest with `nightly_batches` strategy (the default strategy for an
  individual's data is `one_shot`)

**Time to complete init:** ~60 seconds.

**Target user:** an individual power user who wants their personal Obsidian
vault (or mem0 instance, or ReMe store) to be a governed memory for their agent.
The AugmentIQ skill runs in Hermes (or OpenClaw) and turns "I save things to
my vault" into "the agent saves things to my vault, classifies them, retains
them per a policy I set, and audits what it did."

---

### Tier 2: `team`

**Who it's for:** a small team (2-25 people) using AugmentIQ together. Shared
memory, basic RBAC, weekly team review.

**Question count:** 8 questions (5 universal + 3 team-specific). **0 from
Tier 6, 0 from Tier 7.**

**What it unlocks (additionally to Tier 1):**
- Shared memory backend (vault is multi-user)
- Basic RBAC via `/augmentiq role`
- Weekly-review cron (always on)
- Daily-snapshot cron (daily default, not weekly)
- Quarterly audit cron (opt-in via `unit_type ≥ department` if user wants)
  — actually NOT enabled at team tier by default, only department+

**What it does NOT unlock:**
- Compliance packs (team doesn't typically have a DPO)
- 4-tier classification (3-tier default at team)
- Multi-agent federation

**Time to complete init:** ~5 minutes.

**Target user:** a small team lead who wants their team to share an Obsidian
vault (or mem0 instance) for context. Sales team sharing customer notes.
Engineering team sharing incident postmortems. Design team sharing decisions.

---

### Tier 3: `department`

**Who it's for:** a department (25-500 people) within a larger org. May have a
DPO, may have compliance obligations, may have multiple teams with different
needs.

**Question count:** 14 questions (5 universal + 3 team + 6 department). **Opt-in
to Tier 6 (compliance), 0 from Tier 7.**

**What it unlocks (additionally to Tier 2):**
- 4-tier classification scheme
- Full audit log with `audit_log_retention_days` configurable
- Compliance packs (GDPR, SOC2, HIPAA, ISO 27001)
- DSR workflow
- Legacy ingest with `nightly_batches` strategy
- Quarterly audit cron (enabled by default)
- `/augmentiq role` with full RBAC
- Multi-source legacy ingest (up to 5 sources by default, more via Advanced)

**Time to complete init:** ~15 minutes.

**Target user:** a department head (or department IT) who needs the team's
context to be agent-ready, classified, retained, and audit-ready. May be the
first compliance-aware deployment in the org.

---

### Tier 4: `organisation`

**Who it's for:** the whole org (500+ people). Multiple departments, multiple
agents, multiple data residency requirements, full compliance stack.

**Question count:** 22 questions (5 universal + 3 team + 6 department + 8
organisation). **Opt-in to Tier 6 (compliance), opt-in to Tier 7 (advanced).**

**What it unlocks (additionally to Tier 3):**
- Multi-agent federation (multiple agents sharing the AugmentIQ config)
- Cross-backend queries (one agent can query multiple backends via the audit log)
- Full compliance stack with pack-by-pack activation
- Custom classification schemes (`custom_classifications[]`)
- Webhook integration (`integration_webhooks[]`)
- All 8 event triggers (decision, commit, customer_interaction, incident,
  policy_change, hire, departure, contract_signed)
- All 6 cron cadences
- Audit log retention defaults to 10 years (vs 7 for department)

**Time to complete init:** ~45 minutes.

**Target user:** a CTO, CIO, or Head of AI who is deploying agentic memory across
the whole org and needs the full governance + compliance + multi-agent stack.

---

## The questionnaire UX

The questionnaire is the surface every user touches first. It must:
1. Not feel like bureaucracy (mitigates "form fatigue")
2. Suggest smart defaults that adapt to prior answers (mitigates "bad defaults")
3. Explain what each question is for and what the answer will do (mitigates
   "no explainer")
4. Use progressive disclosure (skip blocks the user doesn't need)
5. Be skippable (the user can always edit `~/.augmentiq/config.yaml` directly)

### The 3 failure modes (and mitigations)

#### Failure 1: Form fatigue

**Symptom:** user opens the questionnaire, sees 14 or 22 questions, abandons.

**Mitigation — Progressive disclosure:**

The questionnaire is structured in blocks. The user only sees the blocks that
apply to their answers.

**Universal block (always shown, 5 questions):**
- Tier 1 — Identity (unit_type, unit_name, owner_name, owner_contact)
- Tier 2 — Host environment (host_agent, host_os, memory_backend, memory_location,
  deployment_location)

**Per-tier block (shown after universal, depends on `unit_type`):**
- Team block: 3 questions (memory_shared, memory_partition_strategy, snapshot_cadence)
- Department block: 6 questions (classification_scheme, retention_period_days,
  audit_log_retention_days, has_legacy_data, event_triggers, dpo_contact)
- Organisation block: 8 questions (multi_agent_federation, custom_classifications,
  integration_webhooks, breach_notification_sla_hours, breach_notification_workflow,
  escalation_matrix_owner, escalation_matrix_dpo, data_residency_region)

**Opt-in blocks (only if user answers yes to the trigger question):**
- Legacy ingest block: per-source loop (9 questions per source)
- Compliance block: regulations[] + dpo_contact (only if regulations is non-empty)
- Advanced block: 4 questions (multi_agent_federation, custom_classifications,
  event_triggers, integration_webhooks)

**Max questions ever shown in one continuous run:**
- Individual: 5 (universal only)
- Team: 5 + 3 = 8
- Department: 5 + 3 + 6 = 14, plus opt-in blocks if triggered
- Organisation: 5 + 3 + 6 + 8 = 22, plus opt-in blocks if triggered

**Source:** This is the same pattern as the Agent Skills spec's progressive
disclosure model (metadata → body → references), applied to the questionnaire
UX. The user only sees what they need.

#### Failure 2: Bad defaults

**Symptom:** the user picks "forever" for retention, "internal" for everything,
"monthly" for snapshot. Their vault fills up, their classification is too coarse,
their daily capture is missed.

**Mitigation — Smart defaults that derive from prior answers:**

Every question has a default. The default is *not* a constant — it's a function
of the user's prior answers. The full derivation table is in `references/variables.md`
under "Smart-default derivation."

**Example flow:**

```
Q1: unit_type = individual
    → smart default: snapshot_cadence = weekly
    → shown to user as: "Recommended: weekly snapshots (you can change this)."

Q2: snapshot_cadence
    → shown with default "weekly"
    → user can press Enter to accept, or type to override

Q3: classification_scheme
    → for unit_type = individual, smart default = "none"
    → shown: "You don't need classification for a personal setup. Skip?"

Q4: regulations
    → for unit_type = individual, smart default = empty
    → shown: "No compliance packs apply. Skip?"
    → user presses Enter, the compliance block is skipped
```

**The user accepts the smart default with Enter. They override with a typed
answer. No friction for the common path.**

#### Failure 3: No explainer

**Symptom:** user is asked "what's your DPO contact?" and has no idea what a
DPO is or why the question is being asked.

**Mitigation — Every question has a "why we ask" footnote + `?` for full context:**

```
Q14: DPO contact (data protection officer)?

  We ask this because you've enabled GDPR. AugmentIQ needs a contact to
  notify on data subject requests and breach events. The DPO is the
  person in your org responsible for data protection compliance.

  Format: name + email, or a known platform handle (@username in Slack).

  Press ? for the full GDPR Article 39 reference.
```

**The "why we ask" is always one line. The full reference is behind `?`. The
user gets the context they need without the question feeling patronising.**

### UX patterns (from skill-creator's writing guidance)

Per the skill-creator skill (the meta-skill for creating skills), all
questionnaire directives should:

1. **Prefer the imperative form** in the agent's instructions to the user.
   Not "you might want to set..." but "Set the snapshot cadence."
2. **Define output formats** explicitly. When the user answers, the agent
   shows the formatted preview: "This means: daily snapshots at 02:00, 1-year
   retention, no compliance. OK?"
3. **Include examples** for non-obvious answers. "Format: name + email" beats
   "Enter a DPO contact."
4. **Explain why, not just what.** "We ask this because..." is in every
   question, not just the tricky ones.

**Source:** Anthropic's skill-creator skill, "Writing Patterns" section.
URL: https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md

---

## The per-tier question set (canonical)

### Universal block (5 questions, all tiers)

These are always asked, in this order.

1. **`unit_type`** — "Are you setting up AugmentIQ for an individual, a team, a
   department, or an organisation?"
   - Options: `individual`, `team`, `department`, `organisation`
   - Smart default: none (must be asked)
   - Why: gates which other questions are shown

2. **`unit_name`** — "What's the name of this unit? (e.g., 'Sales team',
   'Finance department', 'Acme Corp', or your own name)"
   - Format: string, ≤100 chars
   - Smart default: "Unnamed Unit" (only if user explicitly skips)
   - Why: used in the audit log, the timeline, the config

3. **`owner_name`** — "Who's the primary contact / owner for this AugmentIQ
   setup?"
   - Format: string, ≤100 chars
   - Smart default: must be asked
   - Why: every state change is attributed to the owner

4. **`host_agent`** — "I detect you are running [detected_agent] v[version] on
   [os]. Correct? (y/n) [if no, list alternatives]"
   - Smart default: auto-detected
   - Why: gates which cron pattern to use

5. **`memory_backend`** — "Which memory backend are you using? (Obsidian, Hermes
   native MEMORY.md, mem0, ReMe, or custom)"
   - Smart default: auto-detected if possible
   - Why: gates which backend reference is loaded

### Team block (3 questions, team+ tiers)

Shown if `unit_type ∈ {team, department, organisation}`.

6. **`memory_shared`** — "Is this memory shared across multiple users?"
   - Options: yes / no
   - Smart default: yes (since unit_type > individual)
   - Why: enables RBAC

7. **`memory_partition_strategy`** — "How should records be partitioned? (per
   agent instance, per department, per user, or one global namespace)"
   - Options: `by_agent`, `by_department`, `by_user`, `global`
   - Smart default: `by_agent` for team, `by_department` for department+
   - Why: storage layout, recall scope, audit grouping

8. **`snapshot_cadence`** — "How often should the agent capture context snapshots?
   (realtime / daily / weekly / monthly / on-event)"
   - Options: from enum
   - Smart default: `daily` for team, `realtime` for department+
   - Why: drives cron registration

### Department block (6 questions, department+ tiers)

Shown if `unit_type ∈ {department, organisation}`.

9. **`classification_scheme`** — "What classification scheme? (none / public-internal-confidential
   / public-internal-confidential-restricted / custom)"
   - Options: from enum
   - Smart default: `four_tier` for department+
   - Why: drives retention map, PII auto-upgrade, compliance pack mapping

10. **`audit_log_retention_days`** — "How long should the audit log be retained?
    (default 7 years for department, 10 years for organisation)"
    - Format: integer (days)
    - Smart default: 2555 (7yr) for department, 3650 (10yr) for organisation
    - Why: drives timeline retention enforcement

11. **`has_legacy_data`** — "Do you have historical data you want to bring into
    the agent's memory? (yes / no)"
    - Options: yes / no
    - Smart default: no
    - Why: gates the legacy ingest block

12. **`event_triggers`** (preliminary) — "Which on-event captures do you want?
    (decision / commit / customer_interaction / incident / policy_change / hire
    / departure / contract_signed)"
    - Options: multi-select from enum
    - Smart default: `[decision, commit, customer_interaction]` for department,
      all 8 for organisation
    - Why: drives the on-event cron registration

13. **`dsr_workflow`** — "How automated should DSR fulfillment be? (manual /
    semi-automated / automated)" — only if GDPR enabled later

14. **`breach_notification_sla_hours`** — "What's your breach notification SLA?
    (default 72hr per GDPR)"

### Organisation block (8 questions, organisation tier only)

Shown if `unit_type = organisation`.

15. **`multi_agent_federation`** — "Do you want multiple agents to share this
    AugmentIQ config?"
    - Options: yes / no
    - Smart default: yes (since unit_type = organisation)
    - Why: enables cross-agent coordination

16. **`data_residency_region`** — "Where must your data reside? (e.g., EU, US,
    APAC, custom)"
    - Format: enum
    - Smart default: same as `deployment_location`
    - Why: gates memory backend choice (some backends don't support all regions)

17. **`escalation_matrix_owner`** — "Who is the primary escalation contact for
    AugmentIQ-related incidents?"
    - Format: name + email
    - Smart default: `owner_name` + `owner_contact`
    - Why: incident response

18. **`escalation_matrix_dpo`** — "Who is the secondary escalation contact?
    (usually the DPO if you have one)"
    - Format: name + email
    - Smart default: derived from `dpo_contact` if GDPR enabled
    - Why: backup contact

19. **`custom_classifications`** — (only if `classification_scheme = custom`)

20. **`integration_webhooks`** — "Webhook URLs to notify on state changes?
    (HTTPS only, one per line)"
    - Format: list of URLs
    - Smart default: empty
    - Why: external alerting

21-22. (Additional organisation-specific questions, e.g., department-by-department
configuration if the user wants to set per-department policies)

### Legacy ingest block (per-source loop, opt-in)

Shown for each `legacy_source` declared in Q11.

For each source:
- `source_type` — which system (Salesforce, SharePoint, etc.)
- `source_category` — derived (local_files, cloud_storage, standard_saas,
  email, enterprise_platform)
- `volume_gb` — rough GB estimate
- `item_count` — item count
- `oldest_year` — year of oldest record
- `classification_default` — public / internal / confidential / restricted
- `transfer_strategy` — one_shot / nightly_batches / paused (auto-recommended
  based on volume)
- `batch_size` — small_100 / medium_1000 / large_10000 / xl_100000
  (auto-recommended based on volume)
- `estimated_completion_date` — shown for confirmation

### Compliance block (opt-in)

Shown only if `regulations` is non-empty.

- `regulations[]` — multi-select: GDPR, SOC2, HIPAA, ISO 27001, CCPA, PCI DSS
- `dpo_contact` — name + email
- `breach_notification_sla_hours` — integer
- `dsr_workflow` — manual / semi-automated / automated

### Advanced block (opt-in)

Shown only if user says "yes, I want advanced features."

- `multi_agent_federation` — yes / no
- `custom_classifications[]` — list of strings
- `event_triggers[]` — multi-select (full list)
- `integration_webhooks[]` — list of URLs

---

## The on-disk questionnaire files

The agent loads the questionnaire from `assets/questionnaires/<unit_type>.json`.
The JSON shape:

```json
{
  "unit_type": "individual",
  "version": "0.1.0",
  "blocks": [
    {
      "id": "universal",
      "always_shown": true,
      "questions": [
        {
          "id": "unit_type",
          "prompt": "Are you setting up AugmentIQ for an individual, a team, a department, or an organisation?",
          "type": "enum",
          "options": ["individual", "team", "department", "organisation"],
          "required": true,
          "default": null,
          "why_we_ask": "This determines which other questions you see and which features unlock."
        },
        ...
      ]
    },
    {
      "id": "team",
      "always_shown": false,
      "shown_if": "unit_type in ['team', 'department', 'organisation']",
      "questions": [...]
    },
    {
      "id": "department",
      "always_shown": false,
      "shown_if": "unit_type in ['department', 'organisation']",
      "questions": [...]
    },
    {
      "id": "organisation",
      "always_shown": false,
      "shown_if": "unit_type == 'organisation'",
      "questions": [...]
    },
    {
      "id": "legacy_ingest",
      "always_shown": false,
      "shown_if": "has_legacy_data == true",
      "loop_body": true,
      "questions": [...]
    },
    {
      "id": "compliance",
      "always_shown": false,
      "shown_if": "regulations is not empty",
      "questions": [...]
    },
    {
      "id": "advanced",
      "always_shown": false,
      "shown_if": "user opted in at end of init",
      "questions": [...]
    }
  ]
}
```

The agent reads this JSON at init time, walks the blocks in order, applies
the `shown_if` rules, and presents the active questions to the user.

---

## The "skip the questionnaire" escape hatch

The user can skip the questionnaire entirely by:

1. Writing `~/.augmentiq/config.yaml` directly (Principle 2).
2. Running `/augmentiq init --defaults` — uses all smart defaults without asking.

The `--defaults` flag is a power-user feature. It uses the most conservative
defaults (individual tier, no compliance, no legacy data) and is suitable for
someone who wants to test AugmentIQ quickly. The user can then run
`/augmentiq reconfigure` to fill in their actual config.

---

## Smart-default summary table

| Question | Tier | Smart default derivation |
|---|---|---|
| unit_type | 1 | none (must ask) |
| unit_name | 1 | "Unnamed Unit" (only if user skips) |
| owner_name | 1 | must ask |
| host_agent | 1 | auto-detect |
| memory_backend | 1 | auto-detect |
| memory_shared | 2 | true if unit_type > individual |
| memory_partition_strategy | 2 | by_agent for team, by_department for department+ |
| snapshot_cadence | 2 | daily for team, realtime for department+ |
| classification_scheme | 3 | three_tier for team, four_tier for department+ |
| audit_log_retention_days | 3 | 90 individual, 365 team, 2555 department, 3650 organisation |
| has_legacy_data | 3 | no |
| event_triggers | 3 | [decision, commit, customer_interaction] for department, all 8 for organisation |
| dsr_workflow | 3 | semi_automated (only if GDPR enabled) |
| breach_notification_sla_hours | 3 | 72 (GDPR), 60 (HIPAA) |
| multi_agent_federation | 4 | true for organisation |
| data_residency_region | 4 | same as deployment_location |
| custom_classifications | 4 | empty (only if classification_scheme = custom) |
| integration_webhooks | 4 | empty |
| legacy_sources[*].transfer_strategy | 4 (opt-in) | derived from volume_gb + item_count |
| legacy_sources[*].batch_size | 4 (opt-in) | derived from volume_gb |
| regulations[] | 4 (opt-in) | empty unless unit_type ≥ department |

---

## Versioning

The 4 scale tiers and the questionnaire UX are versioned with the skill:

- **v0.1** — the 4 tiers, 5 universal + 3 team + 6 department + 8 organisation
  = 22 max questions, with smart defaults and progressive disclosure.
- **v0.2+** — questions can be added (additive). Smart defaults can be refined.
- **v1.0+** — the questionnaire is contract-grade. Users depend on the smart
  defaults being correct.
- **v2.0** — only if a tier is removed or question semantics change (breaking).

---

**End of questionnaire.md**
