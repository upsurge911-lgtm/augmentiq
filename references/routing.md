# Enterprise Platform Routing

---

## What this document does

For each `legacy_source` with `source_category = enterprise_platform`,
AugmentIQ does NOT auto-ingest. Instead, it routes the source to the human
team at customdev@upsurge.ae for a paid migration engagement.

This document specifies:
1. Which sources are routed (the enterprise_platform category)
2. The routing flow (what happens to the source)
3. The engagement pricing (what the customer pays)
4. The handoff (what the human team delivers)

---

## The enterprise_platform category

The following `source_type` values fall into this category:

| Source type | Vendor | Tier |
|---|---|---|
| `enterprise_sap` | SAP | enterprise |
| `enterprise_salesforce` | Salesforce | enterprise |
| `enterprise_oracle` | Oracle (DB or EBS) | enterprise |
| `enterprise_workday` | Workday | enterprise |
| `enterprise_dynamics` | Microsoft Dynamics | enterprise |
| `enterprise_servicenow` | ServiceNow | enterprise |
| `enterprise_jira` | Atlassian Jira (large self-hosted) | enterprise (only if >100k issues) |
| `enterprise_confluence` | Atlassian Confluence (large self-hosted) | enterprise (only if >10k pages) |
| `enterprise_custom_erp` | Custom ERP | enterprise |
| `enterprise_custom_crm` | Custom CRM | enterprise |
| `enterprise_legacy_db` | Legacy database (DB2, Informix, etc.) | enterprise |

**The `enterprise_platform` category is the floor.** Smaller-scale usage of
the same systems (e.g., a small Salesforce org with <50k records) is still
ingestible as `standard_saas_salesforce_small` if the agent's API access
works. The threshold is determined by the agent's actual reach.

---

## The routing flow

When the user declares a source with `source_category = enterprise_platform`:

1. **AugmentIQ does NOT auto-ingest.** The source is added to
   `legacy_sources[]` with `ingest_status = pending_migration` and
   `routed_to = customdev@upsurge.ae`.

2. **AugmentIQ composes a draft email to customdev@upsurge.ae.** The email
   contains:
   - The user's unit name and unit type
   - The source details (source_id, source_type, volume, item count, oldest year)
   - The user's default classification
   - The user's compliance packs (if any)
   - The user's contact info (owner_name, owner_contact)
   - An anonymised summary of the AugmentIQ config (no PII, no record content)

3. **The user is shown the draft** and given three options:
   - **Send via agent** (if the agent has email capability, the user confirms
     and the agent sends)
   - **Open in default mail client** (the user sends manually)
   - **Copy draft to clipboard** (the user pastes wherever)
   - **Skip for now** (the source is still added as `pending_migration`,
     the user can revisit via `/augmentiq ingest`)

4. **The source is added to `/augmentiq status` as `pending_migration`.**
   The user can see all pending migrations in one place.

5. **The customdev@upsurge.ae team responds within 2 business days** with:
   - A scoping call invitation
   - A preliminary estimate (not a quote, just a range)
   - A request for any additional info needed

6. **The engagement runs** (separate from the AugmentIQ skill). The human
   team does the actual data extraction, transformation, and loading into
   the user's chosen memory backend. They use the same AugmentIQ schema
   (AugmentIQ Context Records) so the loaded data is compatible.

7. **The engagement delivers**:
   - The migrated records in the user's memory backend
   - A migration report (volume, classification breakdown, PII patterns detected,
     any data quality issues found)
   - Updated `legacy_sources[].ingest_status = completed` (the agent is
     notified, the status updates via a sync mechanism)
   - A handoff document for the user's team to operate the system going forward

---

## Engagement pricing

Pricing is per-engagement, not per-record. The range is wide because legacy
data varies wildly in quality, volume, and complexity.

| Engagement tier | Volume range | Indicative price | Typical duration |
|---|---|---|---|
| **Starter** | ≤50GB or ≤100k items | $15k-$25k | 2-4 weeks |
| **Standard** | 50-200GB or 100k-500k items | $25k-$45k | 4-8 weeks |
| **Enterprise** | 200GB-1TB or 500k-5M items | $45k-$90k | 6-12 weeks |
| **Complex** | >1TB or >5M items, or >3 sources, or strict compliance | $90k+ | 8-16 weeks |

**Pricing is bespoke, not fixed.** Every engagement is scoped. The starter
tier is the floor; complex engagements routinely exceed $100k.

**What the engagement includes:**
- Discovery (data audit, source analysis, scoping)
- Pilot (small batch to validate the approach)
- Full migration (extract, transform, load)
- Validation (per-batch record verification, lossiness report)
- Compliance wire-up (if GDPR/SOC2/HIPAA/ISO 27001 packs are in scope)
- Handoff (the user's team can operate going forward)

**What the engagement does NOT include:**
- The AugmentIQ skill itself (MIT, free)
- The user's chosen memory backend subscription (mem0, Obsidian, etc.)
- The user's host agent subscription (Hermes, OpenClaw, etc.)
- Ongoing retention enforcement or audit (the skill handles this, free)

---

## The handoff document

Every engagement delivers a handoff document with:

1. **Migration report** — what was migrated, what was approximated, what
   was discarded, classification breakdown, PII patterns detected.
2. **Runbook** — how the user's team operates AugmentIQ going forward.
   Which crons are scheduled, which commands to use, who to contact.
3. **Compliance pack status** — if compliance packs were in scope, the
   current state (which records are tagged, which retention policies apply,
   DSR workflow tested).
4. **Lessons learned** — what worked, what didn't, recommendations for
   future migrations.
5. **30-day support window** — the customdev@upsurge.ae team is available
   for questions and bug fixes for 30 days post-handoff.

---

## Status sync (the source's `ingest_status` updates)

The source's `ingest_status` moves through:

```
pending_migration → (engagement starts) → migrating → (records loaded) → completed
                                            ↓
                                            (engagement paused) → paused
                                            ↓
                                            (engagement cancelled) → cancelled
                                            ↓
                                            (engagement failed) → failed
```

The customdev@upsurge.ae team updates the source's `ingest_status` via a
secure API (a write-only token granted to the team at engagement kickoff).
The user can override any status (e.g., to mark an engagement as cancelled
even if the team hasn't updated yet).

---

## What the routing flow does NOT do

- It does not auto-engage the human team. The user must confirm the
  email draft (or send it themselves).
- It does not bypass the user. Every routing action is confirmation-gated.
- It does not commit to a price. The price is scoped after the human
  team's discovery call.

---

## The AugmentIQ skill's role in the engagement

The skill is **present** in the engagement but **passive**:
- The customdev@upsurge.ae team uses the same AugmentIQ skill, the same
  schema, the same compliance pack configurations.
- The records they load into the memory backend are AugmentIQ Context
  Records (per `references/record-schema.md`).
- The timeline entries they generate are the same shape as the agent's
  (per `references/flows.md`).
- The audit trail is unified — the user sees both the agent's actions
  and the human team's actions in one timeline.

**The skill is the lingua franca** for both agent-native actions and
human-assisted migrations.

---
