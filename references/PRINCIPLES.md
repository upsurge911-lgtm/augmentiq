# The 5 Immutable Principles of AugmentIQ

---
## Principle 1 — "We don't own your memory."

**Rule:** AugmentIQ never writes directly to a backend without explicit per-action confirmation.

### Real-world failure it prevents

A user installs AugmentIQ, runs `/augmentiq init`, fills out the questionnaire, and
walks away. The next morning, the daily-snapshot cron fires. The agent writes 247
records to the user's Obsidian vault, including ones tagged with the wrong
classification, two records that the user hadn't intended to keep, and one that
contains a customer email the user had marked "do not save." The user discovers this
on day 3 and is now staring at a polluted vault that they have to manually clean.

**Why this happens without the principle:** the skill's directives tell the agent
"write records to memory_backend." A naive implementation interprets that as "do it
whenever the cron fires." The user never gets a chance to review or veto.

### Mechanism that enforces it

1. **Cron definitions do not include the write command directly.** Instead, the cron
   fires a *confirmation prompt* in the user's agent session. If the user is not
   active, the cron is queued for the next active session.
2. **`/augmentiq snapshot` always previews the proposed writes** before committing:
   ```
   About to write 247 records to your Obsidian vault:
     - 240 tagged "internal"
     - 5 tagged "confidential"
     - 2 flagged for review (classification unclear)
   Proceed? [y/n/review-2]
   ```
3. **The AugmentIQ audit log records every write** with `user_confirmed: true|false`.
   The user can query `audit_log where user_confirmed = false` to find any
   unauthorized writes.
4. **The skill instructs the agent to refuse bulk writes** without explicit per-batch
   confirmation, regardless of how the cron was scheduled.

### Source citation

- Agent Skills spec, "Principle of Lack of Surprise" (from
  `https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md`):
  *"skills must not contain malware, exploit code, or any content that could
  compromise system security. A skill's contents should not surprise the user in
  their intent if described."* — AugmentIQ extends this from "no malware" to
  "no unannounced writes."

---

## Principle 2 — "We don't own your agent."

**Rule:** The host agent retains full authority. AugmentIQ's recommendations are
suggestions; the user can override any.

### Real-world failure it prevents

A user runs `/augmentiq init` for their department. The skill recommends
"snapshot_cadence: realtime" and "classification_scheme: four_tier." The user
agrees because the defaults look reasonable. Two weeks later, the user realises
they need different cadences per team, and they want a custom 6-tier classification
that includes "internal-restricted" between confidential and restricted. They edit
`~/.augmentiq/config.yaml` directly, restart, and... the agent ignores their edits
because the skill cached the original questionnaire answers.

**Why this happens without the principle:** the skill becomes a black box. The user
has to "ask AugmentIQ" to change anything, and the change is mediated by the
questionnaire UX rather than direct config edits.

### Mechanism that enforces it

1. **The canonical source of truth is `~/.augmentiq/config.yaml`**, a plain YAML file
   in the user's home directory. The questionnaire writes to it. Direct edits to it
   are valid. The agent reads from it on every action.
2. **The skill's directives use the user's config as the source of truth**, never a
   cached or in-memory copy that could drift.
3. **`/augmentiq reconfigure`** is a convenience command that re-runs the
   questionnaire, but the user can skip it and edit YAML directly. Both paths are
   valid.
4. **The skill never tells the agent to "remember" a value the user didn't provide.**
   If a value is missing, the agent asks, defaults it, or refuses — never invents.
5. **`/augmentiq status` shows the live config** as the agent sees it, so the user
   can verify their edits took effect.

### Source citation

- Anthropic engineering blog (origin of Agent Skills standard, Oct 16 2025, open
  standard Dec 18 2025): *"a skill is a folder containing a SKILL.md file... it
  includes metadata (name and description, at minimum) and instructions that tell
  an agent how to perform a specific task."* — The agent retains authority. The
  skill is one input among many.
- Agent Skills spec, progressive disclosure model: metadata → body → references are
  all loaded *on demand*. The agent decides when. The skill does not force-load.

---

## Principle 3 — "Your data is yours, forever."

**Rule:** Every action is reversible. Migration is bidirectional. No lock-in, ever.

### Real-world failure it prevents

A user picks mem0 as their memory backend because the marketing looked good. They
run AugmentIQ, ingest 8 months of context, build their agent workflows around it.
mem0 raises prices 3x. The user wants to switch to Obsidian. They discover their
data is in mem0's proprietary format, there's no export tool, the API rate-limits
exports, and migrating 8 months of tagged records by hand would take weeks. They
stay with mem0 and pay the new price.

**Why this happens without the principle:** the skill accepts the backend's native
format as the source of truth. Records are stored in mem0's typed record format.
There is no canonical AugmentIQ format to fall back to.

### Mechanism that enforces it

1. **The AugmentIQ Context Record is the canonical format.** Every record the agent
   creates, regardless of which backend it's written to, is first constructed as a
   full AugmentIQ Context Record (id, timestamp, scope, source, content, tags,
   retention_policy, classification, audit_ref, provenance, pii_patterns, embedding).
2. **`/augmentiq export` produces a portable, vendor-agnostic dump** in this canonical
   format (JSON Lines). The dump is the user's property. They can store it anywhere,
   import it into any backend, version-control it, share it with auditors.
3. **`/augmentiq migrate` is bidirectional.** Source → target uses the same
   machinery as target → source. There is no "forward-only" path.
4. **`/augmentiq import` accepts the canonical format dump** and re-hydrates records
   into any configured backend. The user can always come back.
5. **The skill does not require a specific backend.** A user can run AugmentIQ with
   `memory_backend: "local_files"` (just a folder of markdown files) and the system
   works. The portable default is "no vendor required."
6. **The AugmentIQ audit log is portable.** It can be exported as JSON and inspected
   by any tool.

### Source citation

- Agent Skills spec, license field (optional): AugmentIQ uses `MIT` for the core,
  meaning anyone can fork, modify, and self-host. The skill is not a SaaS. The
  user's deployment is theirs.
- Common vendor-lock-in pattern (e.g., per-customer single-vector-DB
  architectures, backend-specific schemas, custom migration tools that
  don't work in reverse): the portability principle is the structural
  difference. AugmentIQ is explicitly backend-agnostic.

---

## Principle 4 — "Confirm before destructive."

**Rule:** Any action that deletes, redacts, expires, batch-skips, migrates, cancels,
or destroys AugmentIQ-managed data requires explicit user confirmation in the same
session, with a summary of what will be removed.

### Real-world failure it prevents

A user runs `/augmentiq retention --enforce` (the monthly retention cron fires
overnight). The cron identifies 1,247 records past their retention period. The
agent, told to "enforce retention," deletes all 1,247 records. The user discovers
the next morning that 200 of those records were customer correspondence that should
have been retained for 7 years per their compliance pack — the user had set the
wrong classification when ingesting, and the wrong retention policy cascaded.

**Why this happens without the principle:** "enforce retention" is a reasonable
directive. The agent enforces. The user never gets a chance to review before
deletion.

### Mechanism that enforces it

1. **The list of destructive actions is enumerated in the SKILL.md body** (delete,
   redact, expire, batch-skip, migrate, cancel, destroy, change regulations[]). Any
   future destructive action is added to this list, not silently.
2. **Every destructive command produces a confirmation prompt** that includes:
   - The count of items affected
   - The classification breakdown
   - The earliest and latest timestamps in the affected set
   - The earliest time the action can be undone (export-before-destroy window)
3. **Bulk actions (>10 items) require typed confirmation**, not just a yes/no click.
   The user types `confirm-delete-1247` or similar. This prevents accidental
   "press enter to continue" from a phone notification.
4. **A pre-destroy export is offered** on every destructive action: "I can save a
   full export of these 1,247 records to `~/.augmentiq/exports/<timestamp>.jsonl`
   before I delete them. Proceed with export + delete? Or just delete? Or cancel?"
5. **Destructive actions are logged to the timeline** with the full confirmation
   text, the user's response, and a hash of what was deleted (for audit purposes
   without retaining the content).
6. **A "dry run" mode exists** for every destructive command: append `--dry-run` to
   see the proposed action without executing it.

### Source citation

- Agent Skills spec, "Principle of Lack of Surprise" (from skill-creator): the
  user must never be surprised by an action.
- GDPR Article 17 (Right to Erasure) and Article 5(1)(e) (Storage Limitation):
  destructive actions must be intentional, documented, and reversible within a
  reasonable window. AugmentIQ implements these as Principle 4.

---

## Principle 5 — "Audit everything."

**Rule:** Every state change is logged to the AugmentIQ timeline, queryable via
`/augmentiq timeline`, exportable as JSON for compliance review.

### Real-world failure it prevents

A company deploys agents across 4 departments. Six months in, a customer files a
GDPR Article 15 access request. The DPO needs to know: "what data does our agent
hold about this customer, and when was each piece collected?" The DPO queries
mem0's history API and gets some answers, but not all — the agent also wrote to
Obsidian, to the CRM's internal notes, and to a shared Drive folder. No single
audit trail exists. The company has to manually reconstruct the picture and risks
missing records. The regulator fines them for incomplete response.

**Why this happens without the principle:** the agent writes to multiple backends.
Each backend has its own (or no) audit log. No unified timeline exists.

### Mechanism that enforces it

1. **The AugmentIQ timeline is the single source of truth for state changes.**
   Every record creation, update, deletion, redaction, retention enforcement, DSR
   fulfillment, migration, ingest batch, and config change generates a timeline
   entry.
2. **Timeline entries are written to the user's memory backend** (the same one
   holding the records), so the audit log lives with the data it audits.
3. **Timeline entries are portable** (JSON Lines format). The user can export the
   full timeline, version-control it, send it to auditors, and restore it.
4. **The timeline includes cryptographic hashes** of the records at the time of the
   action. This means a deleted record's content is provably the same as what was
   hashed, even if the record itself is gone (for retention compliance).
5. **Cross-vendor audit is enabled by the timeline's structure.** Because the
   timeline records `source_backend` for every action, the DPO can ask "what
   actions touched mem0 in Q2?" or "what records were written to Obsidian before
   this user was added to the system?" and get an answer.
6. **`/augmentiq audit` generates a formatted report** for the audit window, with
   pack-specific fields populated (GDPR legal basis, SOC2 control mapping, HIPAA
   covered entity role, ISO 27001 control reference).

### Source citation

- SOC2 CC7.2 (System monitoring and intrusion detection) and CC7.3 (Evaluation of
  security events): the system must produce, retain, and review audit logs of
  changes to the in-scope system. AugmentIQ is the layer that does this for agent
  memory.
- ISO 27001 A.12.4.1 (Event logging) and A.12.4.3 (Administrator and operator
  logs): the system must record user activities, exceptions, and information
  security events. AugmentIQ implements these as the timeline.
- HIPAA §164.312(b) (Audit controls): the system must implement hardware, software,
  and procedural mechanisms that record and examine activity in information
  systems containing ePHI. The AugmentIQ timeline + audit command implement this
  for agent memory.
- mem0 docs: their "history" endpoint is per-record, not system-wide. There is no
  cross-vendor audit possible from mem0 alone. AugmentIQ's timeline is the
  cross-vendor layer.

---

## How the 5 principles interact

The principles are not independent — they reinforce each other:

| Principle | Reinforced by |
|---|---|
| 1. Don't own memory | 4. Confirm before destructive (per-action confirmation) |
| 2. Don't own agent | 1 (per-action), 5 (audit) — the user can override any directive and see what was done |
| 3. Data is yours forever | 1 (no hidden writes), 4 (export-before-destroy), 5 (portable timeline) |
| 4. Confirm before destructive | 5 (audit trail of confirmations), 1 (no surprise writes) |
| 5. Audit everything | 1, 3, 4 — every state change is logged, portable, exportable |

**The system is auditable end-to-end because every action is logged. It is portable
end-to-end because every action is reversible. It is user-controlled end-to-end
because every action is confirmed. It is non-coercive end-to-end because the user
can override any directive and edit any config directly.**

That's the structural property. The 5 principles are how we encode it as a
typed, runnable, spec-compliant skill.

---

## How a contributor can extend without violating the principles

**Allowed additions:**
- New commands, new crons, new backends, new agent hosts, new scale tiers — all
  must default to confirm-before-destructive, audit, and export-before-destroy
  patterns from Principle 4 and 5.
- New compliance packs — must include pack-specific audit fields per Principle 5.
- New questionnaire blocks — must respect the existing smart-default and progressive
  disclosure patterns, not add bulk to the form (Principle 2: don't own the agent's
  UX; the user can always edit config directly).

**Not allowed:**
- Any directive that writes to a backend without per-action confirmation (violates 1, 4).
- Any directive that bypasses the timeline (violates 5).
- Any directive that creates a forward-only path (violates 3).
- Any directive that hides the user's config from them (violates 2).
- Any directive that makes destructive actions reversible only by re-paying (violates 3, 4).

**Process for proposing a new principle:**
1. Open an issue with a real-world scenario the existing 5 don't cover.
2. Show how adding the 6th principle would have prevented the scenario.
3. Show that the new principle doesn't conflict with any existing one.
4. Update the SKILL.md body, the reference docs, and the questionnaire logic.
5. Bump the major version. A principle change is a major-version change.

---

## Versioning

The 5 principles are versioned with the skill:
- **v0.1.x** — initial 5 principles as documented here.
- **v0.2+** — principles can be refined, but not removed or contradicted.
- **v1.0+** — principles are stable, contract-grade. Compliance packs cite them.
- **v2.0** — only if a 6th principle is added (see process above).

The AugmentIQ core team (currently: Amit + this skill) commits to not relaxing any
of the 5 principles without a major version bump and a public changelog entry.

---

**End of PRINCIPLES.md**
