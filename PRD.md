# AugmentIQ v0.1 — Product Requirements Document

> **Status:** v0.1 PRD, candidate for sign-off.
> **Author:** Robin (Amit's AI operator, on his behalf).
> **Date:** 2026-07-16.
> **License of this PRD:** CC-BY-4.0 (you can share, but attribute).
> **License of the resulting skill:** MIT (per the Agent Skills open standard).
>
> **This is a thin document.** It is the index, table of contents, and
> contract. The substance lives in the 22 reference docs at
> `/tmp/aug-docs/` (which become `references/` in the shipped skill).
> Each section below names the reference that backs it. If the PRD
> contradicts a reference, the reference wins (the PRD is updated).

---

## 0. How to read this PRD

Each of the 22 sections below has three parts:

1. **What** — a 1-3 sentence statement of what the section delivers.
2. **Why** — why this section exists in v0.1 (and not deferred to v0.2).
3. **Backed by** — the reference document(s) at `/tmp/aug-docs/` that
   contain the substance. Read those, not this PRD, for the detail.

After the 22 sections, there is a "Decisions to confirm" block — the
5 calls that must be made before this PRD is final.

The "v0.1 launch checklist" at the end is the gate.

---

## 1. The Manifest

**What.** AugmentIQ is a portable Agent Skill that, when installed into
any Agent-Skills-compliant host agent, turns that agent + the user's
chosen memory backend into a system that captures context, classifies
it, retains it per regulation, audits every state change, and lets
the user migrate to a different backend with one command.

**Why.** This is the one-paragraph answer to "what is AugmentIQ?" It
appears in the README, on the website, in every partnership email,
and in the agentskills.io listing. It must be unambiguous.

**Backed by.** The "What is AugmentIQ" framing synthesised from
`PRINCIPLES.md`, the `MEMORY.md` (curated context the agent maintains),
and the `dreaming-systems-research.md` (which corrects earlier
speculative framing about a DREAMS function that does not exist in
Hermes).

---

## 2. The Skill Itself

**What.** A `SKILL.md` body (under 500 lines, under 5000 tokens) plus
a `references/` folder plus an `assets/` folder, conforming to the
Agent Skills open standard (https://agentskills.io/specification).
MIT-licensed. The body is a table of contents pointing to the
references; the references are the substance.

**Why.** The Agent Skills spec is the distribution mechanism. Without
spec compliance, the skill does not load in 40+ agents. With it, the
skill is installable everywhere.

**Backed by.** The Agent Skills spec (https://agentskills.io/specification)
and the `skill-creator.md` (Anthropic's writing patterns).

---

## 3. The 5 Immutable Principles

**What.** Five principles that never change. Every flow, every command,
every reference derives from these:
1. We don't own your memory.
2. We don't own your agent.
3. Your data is yours, forever.
4. Confirm before destructive.
5. Audit everything.

**Why.** Without immutable principles, the skill degenerates into a
generic "AI memory tool" without a point of view. The principles are
the constitution. They are the answer to "why this and not X?"

**Backed by.** `/tmp/aug-docs/PRINCIPLES.md` (340 lines, 5 principles,
each with Rule + Real-world failure + Mechanism + Source citation).

---

## 4. The 7-Tier Variable Schema

**What.** The typed contract for `~/.augmentiq/config.yaml`. 38
variables across 7 tiers: Identity (3), Host (5), Memory (6),
Compliance (8), Capture (5), Legacy (4), Advanced (7). Per variable:
name, type, default, scope, validation.

**Why.** The questionnaire writes to this schema. The crons read from
it. Without a typed schema, the config is a free-form YAML and the
agent cannot reason about it.

**Backed by.** `/tmp/aug-docs/variables.md` (682 lines, 38 variables,
YAML example, smart-default derivation table).

---

## 5. The 26 Slash Commands

**What.** The 26 user-facing actions, grouped:
- **Onboarding (4):** `init`, `status`, `reconfigure`, `destroy`
- **Capture (3):** `snapshot`, `save`, `tag`
- **Query (3):** `recall`, `timeline`, `who-knows`
- **Compliance (5):** `audit`, `retention`, `redact`, `dsr`, `role`
- **Migration (3):** `migrate`, `export`, `import`
- **Legacy ingest (7):** `ingest`, `ingest status`, `ingest pause`,
  `ingest resume`, `ingest retry`, `ingest skip`, `ingest cancel`,
  `ingest report`
- **Meta (1):** `help`

**Why.** This is the user API. Once learned, it's stable across all
hosts and all backends. The 26 commands (note: 26, not 24 as I had
earlier — `ingest report` is its own command) are the surface area
of v0.1.

**Backed by.** `/tmp/aug-docs/commands.md` (1,592 lines, all 26
commands with full spec).

---

## 6. The 6 Cron Cadences

**What.** Six scheduled-action types:
- **daily-snapshot** (02:00 daily) — capture the current state
- **weekly-review** (Sunday 04:00) — surface changes, stale items
- **monthly-retention** (1st of month 03:00) — enforce retention
- **quarterly-audit** (last day of quarter 04:00) — full audit report
- **ingest-batch** (02:00 nightly, only if pending legacy work) —
  pull the next batch
- **on-event** (commit/merge/decision/customer-interaction/incident/
  policy-change/hire/contract) — capture the event

**Why.** Cron is what makes AugmentIQ "run" without the user
prompting it. Without crons, the skill is a manual tool, not a
system.

**Backed by.** `/tmp/aug-docs/crons.md` (601 lines, per-host templates
for Hermes, OpenClaw, Claude Code, Codex, Cursor, nanobot).

---

## 7. The 4 Scale Tiers

**What.** Four `unit_type` levels — individual, team, department,
organisation — each with its own questionnaire (5, 11, 17, 22
questions), default scope, default compliance, default classification,
default cron set.

**Why.** One questionnaire cannot serve both an individual with 1 GB
of Obsidian notes and a 200-person org with SAP and 5 compliance
regimes. The 4 tiers let the skill be appropriate for each, without
overwhelming the user.

**Backed by.** `/tmp/aug-docs/questionnaire.md` (571 lines, per-tier
questions, smart defaults, progressive disclosure, 3 failure-mode
mitigations).

---

## 8. The 10 Operational Flows

**What.** Ten end-to-end flows: `detect`, `init`, `capture`,
`retention`, `audit`, `migration`, `legacy_ingest`, `dsr`,
`failure_ux`, `destroy`. Each with trigger, pre-conditions, steps,
confirmation points, outputs, failure modes, audit log entry.

**Why.** When the agent needs to know the steps for any action, it
loads the flow. The flows are what the SKILL.md body references when
it says "On `/augmentiq init`, do this..."

**Backed by.** `/tmp/aug-docs/flows.md` (786 lines, 10 flows + 7
failure categories).

---

## 9. The Legacy Ingest Model

**What.** The end-to-end migration service for legacy data. Six
sub-docs:
- `strategies.md` — the strategy decision tree (one_shot vs
  nightly_batches vs paused)
- `estimator.md` — the time/cost estimator (volume + item count → hours
  per category)
- `batch_protocol.md` — the per-batch audit log format
- `pii-patterns.md` — the 12 PII patterns + GDPR/HIPAA/PCI overlays
- `routing.md` — the enterprise platform routing to
  `customdev@upsurge.ae`
- `sources/{local_files, cloud_storage, standard_saas, email}.md` —
  the 4 per-category ingest directives

**Why.** This is the "AI-native legacy migration" service. It's the
*primary* value prop for enterprise customers (Government, Defence,
Healthcare, Logistics, Manufacturing). It's also where AugmentIQ
differentiates from competitors: agent-native sources are automated,
enterprise sources route to humans.

**Backed by.** 9 files in `/tmp/aug-docs/` totalling ~3,000 lines.

---

## 10. The Backend References (6 backends)

**What.** One reference per supported memory backend:
- **Obsidian** — local-first Markdown, the most common individual backend
- **mem0** — cloud memory layer, the most common team backend
- **ReMe** — file-based, versioned, for compliance-conscious users
- ~~**Mem360** (360 Labs)~~ — removed from v0.1 scope on 2026-07-17
- **Hermes native** — uses `~/.hermes/memories/MEMORY.md` + `USER.md`
  + `DREAMS.md` (the last being user-maintained, not a system function)
- **Custom** — user-implemented adapter implementing 4 functions

**Why.** AugmentIQ is backend-agnostic. The user picks the backend
they already have. We support the 6 most common.

**Backed by.** 6 files in `/tmp/aug-docs/` (~1,800 lines total).

---

## 11. The Agent References (6+ host agents)

**What.** One reference per supported host agent:
- **Hermes** — primary, the agent the user runs
- **OpenClaw** — secondary, the agent with the dreaming system
- **Claude Code** — supported, external cron
- **OpenAI Codex CLI** — supported, external cron
- **Cursor** — Tier 3, expect compatibility work
- **nanobot** — Tier 3, project in flux
- **Other Tier 3** (Letta, Claude Desktop, Windsurf, Continue,
  PearAI, Zed) — best-effort

**Why.** Same backend-agnostic principle applies to host agents. We
ship on Hermes first (primary), OpenClaw second (proven skill loader,
the canonical examples), then everywhere else.

**Backed by.** 6+ files in `/tmp/aug-docs/` (~1,500 lines total).

---

## 12. The Compliance Packs (4 frameworks)

**What.** Per-framework pack: legal basis mapping, retention defaults,
DSR workflow, audit log requirements, PII overlay. Frameworks:
GDPR, SOC2, HIPAA, ISO 27001.

**Why.** This is the message to the buyer. "We have an agent with
memory" is not enough. "We have an agent with audited, classified,
retained, redactable memory with a DSR workflow" is the buy.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 11.)
Per-framework: legal-basis, retention, DSR, audit, PII overlay,
with the legal-review-deferred-to-v1.1 disclaimer explicit.

**Estimated size:** 4 docs, ~600 lines total. To be drafted
section-by-section with the user's sign-off.

---

## 13. The Record Schema + Timeline Schema

**What.** The canonical shape of:
- **AugmentIQ Context Record** — the unit of storage in the memory
  backend. Fields: id, timestamp, scope, source, content, tags,
  classification, retention_policy, audit_ref, provenance, pii_patterns,
  embedding.
- **Timeline entry** — the unit of audit. One per state change.
  JSON, append-only, content-hashed.

**Why.** The two schemas are the lingua franca across backends. The
agent translates to/from the backend's native format using the
per-backend reference; the schemas themselves are the canonical
contract.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 12.)
Estimated: 2 docs, ~400 lines total. The Context Record format
appears in `obsidian.md` (YAML frontmatter) and `mem0.md` (metadata
field) already; the consolidated canonical schema is what's missing.

---

## 14. The Marketing Surface

**What.** The public-facing artifacts:
- **README.md** — the GitHub landing (problem, install, quickstart,
  compatibility, principles, commands, contributors, license)
- **WEBSITE_READY.md** — the website copy (600 words above-fold +
  supporting sections below)
- **Manifesto** — the thought-leadership piece (the "why this exists"
  essay, ~1,200 words)
- **"Compatible with" badge list** — the logos + the wording for
  Mem0, ReMe, Obsidian (the vendor), Claude Code (the host), and other
  host agents. No memory-vendor partnership is required for v0.1.

**Why.** The skill is the product, the marketing surface is the
distribution. Without a sharp README, agentskills.io curators pass.
Without a sharp website, the Arfeen-style buyer doesn't see the
positioning. Without a manifesto, the thought-leadership angle
collapses.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 14, 21.)
Estimated: 3 docs, ~2,000 lines total.

---

## 15. The Compatibility Matrix

**What.** A 6 hosts × 6 backends = 36 cell matrix. Each cell: ✅ /
⚠️ / ❌ with a one-line note. The truth table for "does AugmentIQ
work with X running Y?"

**Why.** The user wants to know "will this work for me" in 5 seconds.
The matrix answers it. The website embeds it. The README links to it.
The partnership emails reference it.

**Backed by.** Partially in `agent-*.md` and `backend-*.md` (per-cell
notes). The consolidated matrix is NOT YET DRAFTED — todo 15.
Estimated: 1 doc, ~150 lines.

---

## 16. The Ecosystem Gap Analysis

**What.** A 10 capabilities × 6 backends table. The 10 capabilities
include: portable governance, classification, retention enforcement,
audit log immutability, redaction workflow, DSR workflow, role-based
access, multi-backend compatibility, agent-native capture, on-prem
support. **AugmentIQ is the only row with full governance across all
10.** Names Mem0 + ReMe + Obsidian-native explicitly (the 5 supported
backends), and contrasts against the common patterns of single-vendor
stacks.

**Why.** This is the position table. "Why AugmentIQ and not just
Mem0?" — answered in 60 seconds. "Why AugmentIQ and not just
Obsidian?" — answered in 60 seconds. This is the most
important positioning artifact in the entire v0.1.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 16.)
Estimated: 1 doc, ~200 lines, with citations to the per-backend
references and the variable schema.

---

## 17. The Distribution Strategy

**What.** How AugmentIQ gets to users:
- **agentskills.io registry** — submit for listing
- **Per-host marketplaces** — Hermes, OpenClaw, Claude Code, Codex,
  Cursor
- **GitHub repo** — github.com/upsurge911-lgtm/AugmentIQ
- **Per-host marketplace listings** — Hermes, OpenClaw, Claude Code,
  Codex, Cursor (these are the host-agent marketplaces; no
  memory-vendor partnerships are required for v0.1)
- **The Arfeen engagement** — first paid proof point
- **Content** — the manifesto, the website, the LinkedIn presence

**Why.** The best skill in the world is nothing if no one finds it.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 17.)
Estimated: 1 doc, ~300 lines, with per-marketplace submission
process + per-partnership email draft.

---

## 18. The Migration Playbook

**What.** The paid engagement structure:
- **Discovery** (week 1) — data audit, source analysis, scoping
- **Assessment** (week 1) — volume estimates, classification
  recommendations, compliance mapping
- **Pilot** (weeks 2-3) — small batch to validate the approach
- **Full ingest** (weeks 3-6) — extract, transform, load
- **Daily stream** (weeks 6-7) — crons wired up
- **Compliance** (weeks 7-8) — packs configured, DSR tested
- **Handoff** (week 8) — runbook, lessons learned, 30-day support

**Why.** This is the revenue side. Arfeen Khan is the prototype;
the playbook is what makes the 2nd, 3rd, 4th engagement scale.
Pricing tiers: Starter $15-25k, Standard $25-45k, Enterprise
$45-90k, Complex $90k+.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 18.)
Estimated: 1 doc, ~400 lines, with timeline templates, deliverables,
pricing.

---

## 19. The Certification Program

**What.** The consultant certification:
- **Who** — independent consultants + agency staff
- **What** — 4-pillar exam (skill mechanics, host compatibility,
  backend fluency, compliance posture)
- **How** — self-paced online + 1 live session with a certified
  instructor
- **Renewal** — annual, with a new exam (compliance updates)
- **Referral economics** — 10% of the first engagement, 5% of
  engagements 2-5, 0% after (configurable)

**Why.** The skill scales via consultants. Each certified consultant
is a distribution channel. The economics are designed to reward
the first 5 engagements heavily, then taper.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 19.)
Estimated: 1 doc, ~300 lines, with the exam outline + the
certification agreement.

---

## 20. The Compliance Positioning

**What.** The message to compliance officers, framed as:
"We have an agent with memory" → "We have an agent with
**audit-ready** memory." Five themes:
1. **Legal basis** — the record's `provenance` field documents the
   basis (consent, contract, legitimate interest, vital interest,
   legal obligation)
2. **Retention math** — the policy per classification is explicit,
   enforced by cron, exportable
3. **Audit log immutability** — the timeline is append-only, content-
   hashed, content-addressable, queryable
4. **DSR workflow** — the 4 GDPR rights (access, erasure, rectification,
   portability) are `/augmentiq dsr` commands with logged fulfillment
5. **Breach notification** — the audit log timestamps are sufficient
   evidence for the 72-hour notification window under GDPR Art. 33

**Why.** The compliance officer is the gate-keeper for the enterprise
sale. This doc is what they read before approving the engagement.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 20.)
Estimated: 1 doc, ~500 lines, with regulatory citations and the
"how AugmentIQ turns X into Y" framing.

---

## 21. The Website Copy

**What.** The website at augmentiq.dev (or similar):
- **Above the fold (600 words):** problem (legacy context is
  scattered) → solution (portable Agent Skill) → how (5 principles
  + 26 commands + 6 crons) → who for (4 tiers) → compatibility
  (host × backend matrix) → quickstart (3 commands) → CTA
- **Below the fold:** the manifesto, the gap analysis, the case
  study (Arfeen), the pricing, the partners, the certification
- **Footer:** license (MIT for the skill), repo link, contact,
  legal disclaimer

**Why.** The website is the second impression (the GitHub README is
the first). It must convert a visitor who's heard the pitch into a
user who runs the install.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 21.)
Estimated: 1 doc, ~800 lines, with the section-by-section copy.

---

## 22. The Install Test Plan

**What.** The end-to-end test plan per host:
- **Hermes (primary):** install → init → status → snapshot → recall
  → timeline → ingest (small) → migrate (small) → destroy
- **OpenClaw (secondary):** same flow
- **Claude Code (smoke):** install → init → status only
- **Codex / Cursor / nanobot (smoke):** install → init only

For each step, the verification command. For each failure mode, the
recovery action.

**Why.** "It works" is not enough. The test plan proves it works on
each host. Without it, the launch is a claim, not a fact.

**Backed by.** To be written. (Status: NOT YET DRAFTED — todo 22.)
Estimated: 1 doc, ~400 lines, with the per-host commands.

---

## 23. The Final Assembly + v0.1 Launch Checklist

**What.** The shipped package at `/Users/amit/AugmentIQ/`:
```
AugmentIQ/
  SKILL.md                   # the body (under 500 lines, under 5000 tokens)
  references/                # 22 docs, named per the section above
  assets/
    questionnaires/          # 4 JSON files (individual, team, department, organisation)
    email-templates/         # DSR templates
    audit-templates/         # audit report templates
  README.md
  LICENSE                    # MIT
  COMPATIBILITY.md
  ECOSYSTEM_GAP_ANALYSIS.md
  MARKETPLACE.md
  MIGRATION_PLAYBOOK.md
  CERTIFICATION.md
  COMPLIANCE_POSITIONING.md
  INSTALL_TEST.md
  CHANGELOG.md
```

**The launch checklist (the gate):**

- [ ] SKILL.md is validator-passed (under 500 lines, under 5000 tokens)
- [ ] All 22 reference docs are present, cross-linked, internally consistent
- [ ] All 4 compliance packs are drafted
- [ ] All 4 questionnaire JSON files are drafted
- [ ] Install test plan is passed on Hermes (full flow)
- [ ] Install test plan is passed on OpenClaw (full flow)
- [ ] Install test plan is passed on Claude Code (smoke)
- [ ] Website copy is drafted, the "above the fold" hits 600 words
- [ ] README is drafted, all sections complete
- [ ] ECOSYSTEM_GAP_ANALYSIS is drafted, names Mem0 + ReMe + Obsidian-native
- [ ] MARKETPLACE.md is drafted, agentskills.io submission is ready
- [ ] MIGRATION_PLAYBOOK.md is drafted, pricing tiers explicit
- [ ] CERTIFICATION.md is drafted, exam outline present
- [ ] COMPLIANCE_POSITIONING.md is drafted, regulatory citations present
- [ ] WEBSITE_READY.md is drafted, 600-word above-fold present
- [ ] INSTALL_TEST.md is drafted, per-host verification commands present
- [ ] Public GitHub repo at github.com/upsurge911-lgtm/AugmentIQ
- [ ] First 3 "compatible with" partnership emails sent
- [ ] Arfeen engagement contracted (the proof point)
- [ ] Submission to agentskills.io accepted
- [ ] Submission to per-host marketplaces (Hermes, OpenClaw, Claude
      Code, Codex, Cursor) accepted
- [ ] LinkedIn announcement posted
- [ ] Manifesto published on the website

**This is the gate for "v0.1 = done."**

---

## Decisions to confirm before this PRD is final

I will not write the 13 missing docs until you sign off on these:

1. **The 26 commands (not 24, not 27).** `ingest report` is a separate
   command, `help` is a separate command, total = 26. **Confirm or
   correct.**

2. **The 22 sections of v0.1.** Anything to add, remove, or rename?
   I am not going to be precious about the count — 22 is what I
   proposed, you may want 18 or 25.

3. **The "compatible with" partner list.** I propose Mem0, ReMe,
   Obsidian (the vendor — the company, for the badge on the README),
   Claude Code (the host), Codex (the host), Cursor (the host).
   No memory-vendor partnership is required for v0.1; AugmentIQ works
   against any of the 5 supported backends without their permission
   or collaboration. **Confirm or correct.**

4. **The pricing tiers** for the migration playbook (Starter $15-25k,
   Standard $25-45k, Enterprise $45-90k, Complex $90k+). **Confirm
   or correct.**

5. **The certification program economics** (10% of engagement 1,
   5% of engagements 2-5, 0% after, annual renewal). **Confirm or
   correct.**

Once these 5 are confirmed, the PRD is locked, and I write the 13
missing docs in the order I propose:
1. Record Schema + Timeline Schema (todo 12) — the canonical
   types
2. Compliance Packs (todo 11) — depends on the Record Schema
3. README + WEBSITE_READY (todos 14, 21) — the marketing surface
4. COMPATIBILITY (todo 15) + ECOSYSTEM_GAP_ANALYSIS (todo 16) —
   the positioning
5. MARKETPLACE (todo 17) + MIGRATION_PLAYBOOK (todo 18) +
   CERTIFICATION (todo 19) + COMPLIANCE_POSITIONING (todo 20) — the
   distribution
6. INSTALL_TEST (todo 22) — the verification
7. SKILL.md body (todo 13) — the entry point, written last
8. Final assembly (todo 23) — the launch

**Estimated total writing effort for the 13 missing docs: ~5,000
lines, ~3-4 days of focused work, assuming no rework.**

---

## What this PRD does NOT do

- It does not invent features beyond what the references specify.
  If a section says "to be written," the substance of what to write
  is already pinned by the references; only the new material is new.
- It does not commit to a launch date. The launch date is set when
  the v0.1 launch checklist above is fully checked.
- It does not include 0.2 items (dreaming, custom ontologies, voice
  ingestion, mobile, etc.). Those are a separate v0.2 PRD.

---

## License of this PRD

CC-BY-4.0. You can share, but attribute Amit / AugmentIQ / Upsurge.ae.

The skill itself, when shipped, will be MIT (per the Agent Skills
open standard).

---

**End of PRD v0.1**
