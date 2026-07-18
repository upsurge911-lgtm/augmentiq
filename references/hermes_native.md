# Backend: Hermes native MEMORY.md

---

## What this backend is

Hermes AI (the host agent that runs this skill) has its own persistent
memory:

- `MEMORY.md` — a single file with the agent's curated long-term
  memory
- `memory/YYYY-MM-DD.md` — daily log files (one per active day)
- `DREAMS.md` — synthesized long-term context (consolidated from daily
  logs)

**Why use Hermes native:** for Hermes users, the agent's own memory is
already running. AugmentIQ can use it as the backend without any
additional install. The records live in the same files the agent
already maintains.

**This is the simplest possible setup** — no separate service to run,
no API keys to manage, no new file format to learn.

---

## Detection

The agent detects Hermes native by:

1. Looking for `MEMORY.md` in the agent's working directory or
   `~/.hermes/`.
2. Looking for the `memory/` directory (the daily log folder).
3. Asking the user to confirm the location.

**Markers:**

```
~/.hermes/
  MEMORY.md             # the curated long-term memory
  DREAMS.md             # synthesized long-term context
  memory/
    2026-07-15.md       # daily log for 2026-07-15
    2026-07-16.md       # daily log for 2026-07-16
    ...
  .augmentiq/           # AugmentIQ's per-Hermes config (if present)
```

---

## Install path

No install required. Hermes is the host agent; its memory files
already exist. The agent:

1. Verifies the MEMORY.md is writable.
2. Creates the `.augmentiq/` directory in `~/.hermes/`.
3. Reads the existing MEMORY.md to merge with AugmentIQ's structure.

---

## The record transformation

### From AugmentIQ Context Record to Hermes memory entry

There are two write strategies:

**Strategy 1: Append to today's daily log (`memory/YYYY-MM-DD.md`)**

This is the default. Each AugmentIQ record is appended as a new
section in the daily log:

```markdown
## [augmentiq:a1b2c3d4-...] 2026-07-16T14:30:00Z
classification: confidential
tags: [okrs, q3, leadership]
source: email-gmail-personal:abc123

(sent by jane@acme.com to bob@acme.com on 2024-07-12)

(Body content here. The original email body, formatted as Markdown.)

---
audit_ref: timeline/2026-07-16/save-a1b2c3d4
retention_until: 2033-07-15
```

**The daily log is append-only.** The agent never edits a previous
day's file (per Principle 5: audit everything; the daily log is the
audit trail).

**Strategy 2: Promote to MEMORY.md (for high-importance records)**

If the record's classification is `restricted` or its tags include
`promote-to-memory`, the agent adds a summary entry to MEMORY.md:

```markdown
## 2026-07-16 14:30 — Q3 OKR draft
classification: restricted
tags: [okrs, q3, leadership, promote-to-memory]
source: email-gmail-personal:abc123
record_ref: augmentiq:a1b2c3d4-... (full content in memory/2026-07-16.md)

(sent by jane@acme.com to bob@acme.com on 2024-07-12)
Q3 OKR draft: revenue $2.4M, headcount 14.

---
```

**The MEMORY.md is the agent's curated long-term memory.** Only
high-importance records make it here. The full record is in the
daily log; MEMORY.md has the summary.

### From Hermes memory entry to AugmentIQ Context Record

The agent reads the daily logs and MEMORY.md in reverse chronological
order. For each entry:

1. Parse the section header to extract the record id, timestamp,
   classification, tags, source.
2. Parse the body as the content.
3. Reconstruct the AugmentIQ Context Record from the parsed data.

For the audit_ref, the agent uses the daily log filename + section
position (e.g., `memory/2026-07-16.md#a1b2c3d4-...`).

---

## Why the daily log + MEMORY.md split

The daily log is the **append-only audit trail**. Every record is
written there, with full content. The MEMORY.md is the **curated
summary**. Only high-importance records are promoted.

This matches Hermes's own design (per session context):
- `MEMORY.md` is the agent's curated, manually-maintained long-term
  memory.
- `memory/YYYY-MM-DD.md` is the daily journal, never edited after
  the day passes.
- `DREAMS.md` is the periodic synthesis (consolidated from daily
  logs).

AugmentIQ works within this structure rather than imposing a new one.

---

## Known quirks

### Daily log rotation

Hermes creates a new daily log file each day the agent is active.
The agent must:

1. Check the current date at write time.
2. If the date has changed since the last write, append to the new
   daily log file (not the old one).
3. Keep the old daily log files intact (audit trail).

### MEMORY.md size

MEMORY.md can grow large. For users with 10,000+ promoted records,
the file becomes unwieldy. AugmentIQ's mitigation:

- Default promote-to-memory is conservative (only `restricted`
  classification + the `promote-to-memory` tag).
- The user can set `mem_promote_threshold` to a higher classification.
- The user can periodically archive old MEMORY.md sections to a
  separate file (the agent helps with this via `/augmentiq status`).

### Concurrency

If the user is using Hermes on multiple devices, the daily log
files may sync via iCloud, Dropbox, etc. Race conditions are
possible (two devices writing to the same daily log file
simultaneously).

**Mitigation:** the agent uses the record id (UUID) for de-duplication.
If a conflict is detected, the latest timestamp wins (per the
"sync conflicts" pattern in the Obsidian backend).

### DREAMS.md synthesis

Hermes's DREAMS.md is periodically synthesized (per the session
context: "long-term context; 100% memories; periodic synthesis; creative
connections"). AugmentIQ's records are not part of this synthesis
process — DREAMS.md is the agent's own context, not the AugmentIQ
record store.

If the user wants AugmentIQ records in DREAMS.md, they can set
`include_in_dreams: true` in the source config. The agent will
append relevant records to DREAMS.md during the synthesis window.

---

## Performance

- **Read**: fast (filesystem, Hermes's native search is fast).
- **Write**: ~2ms per record (append to daily log).
- **Search**: Hermes's native search is keyword-based by default.
  Semantic search is not native; the agent can add it via the
  embedding sidecar (similar to the ReMe approach).

---

## The "Hermes + AugmentIQ" value prop

For the Hermes user, the value of using Hermes native as the
AugmentIQ backend is:

1. **Zero additional setup.** No new service, no new API key, no new
   file format. The agent's own memory becomes the AugmentIQ
   backend.
2. **Familiar mental model.** The user already understands MEMORY.md
   and the daily log. AugmentIQ just adds governance to the same
   structure.
3. **Audit trail by default.** The daily log is the audit log.
4. **No vendor lock-in.** The data is in the user's `~/.hermes/`
   directory. They can read it, move it, back it up.

**The pricing math:** Hermes (the agent's cost) + AugmentIQ (free).
The user pays for the agent; the governance is free.

---

## What this backend does NOT do

- It does not support multi-user out of the box. MEMORY.md is single-user.
- It does not generate embeddings by default. The user can add this
  via a sidecar.
- It does not provide a UI. The user interacts with Hermes's native
  UI + slash commands.
- It does not work with Hermes Cloud (the cloud version of Hermes
  that has its own memory backend). For Hermes Cloud, the user should
  use the cloud's memory backend (which is essentially mem0 or
  similar).

---
