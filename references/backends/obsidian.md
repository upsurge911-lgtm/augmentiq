# Backend: Obsidian

---

## What this backend is

Obsidian is a local-first Markdown knowledge base. Each record becomes a
`.md` file in the user's vault. The YAML frontmatter holds the AugmentIQ
metadata (id, timestamp, classification, tags, etc.). The body holds the
content.

**Why Obsidian:** the user owns the data, the format is portable, the
ecosystem is rich (plugins, queries via Dataview, search, graph view), and
the files are human-readable.

---

## Detection

The agent detects Obsidian by:

1. Looking for a `~/.obsidian/` config directory.
2. Looking for `.obsidian/` in a parent of a folder with many `.md` files.
3. Asking the user to confirm the vault location.

**Markers:**

```
vault_root/
  .obsidian/                    # Obsidian's config (auto-generated)
  .augmentiq/                   # AugmentIQ's per-vault config (if present)
  *.md                          # user's notes
  attachments/                  # Obsidian's attachment folder
```

---

## Install path

Obsidian itself is a desktop app (download from obsidian.md). The
AugmentIQ skill does not install Obsidian. The user is expected to have a
vault set up.

**The agent's setup:**

1. Verify the vault is readable/writable.
2. Create `.augmentiq/` inside the vault (for AugmentIQ-specific config
   like `config.yaml` and `crons.yaml`).
3. Tell the user to exclude `.augmentiq/` from Obsidian's plugin scope
   (it should not be edited by Obsidian).

**No additional install is required for the user.** The AugmentIQ skill
+ Obsidian = working memory.

---

## The record transformation

### From AugmentIQ Context Record to Obsidian Markdown file

**File path:** `<vault_root>/<classification>/<scope>/<source>/<safe_title>.md`

Where:
- `classification` = one of `public`, `internal`, `confidential`, `restricted`
- `scope` = the unit type (e.g., `individual`, `team-sales`)
- `source` = a sanitized source path (e.g., `email-gmail-personal`, `local-files-obsidian-personal`)
- `safe_title` = a sanitized version of the record's first 80 chars of content, or the record id if no content

**File content (YAML frontmatter + Markdown body):**

```markdown
---
id: augmentiq:a1b2c3d4-e5f6-7890-abcd-ef1234567890
timestamp: 2026-07-16T14:30:00Z
scope: organisation
source: email-gmail-personal:abc123
content_type: email
classification: confidential
retention_policy: 2555
retention_until: 2033-07-15
tags:
  - okrs
  - q3
  - leadership
pii_patterns:
  - email
  - monetary_amount
audit_ref: timeline/2026-07-16/save-a1b2c3d4
provenance:
  source_system: email
  email_metadata:
    from: jane@acme.com
    to:
      - bob@acme.com
    subject: Q3 OKR draft
    date: 2024-07-12T16:45:00Z
embedding: <vector reference, not stored in frontmatter>
embedding_ref: augmentiq-embeddings/a1b2c3d4
---

# Q3 OKR draft

(sent by jane@acme.com to bob@acme.com on 2024-07-12)

(Body content here. The original email body, formatted as Markdown.)

## Threading

This email is part of a thread. See related records:
- augmentiq:f7e8d9c0-... (parent)
- augmentiq:1a2b3c4d-... (next reply)

## AugmentIQ metadata

- Created: 2026-07-16T14:30:00Z by /augmentiq save
- Last accessed: never
- PII detected: yes (email, monetary_amount)
- Classification: confidential
- Retention: until 2033-07-15
```

**The Markdown body is human-readable.** The frontmatter is machine-readable.
Obsidian's plugin ecosystem (Dataview, etc.) can query the frontmatter
to show, e.g., "all records tagged okrs" or "all records past retention."

### From Obsidian Markdown file to AugmentIQ Context Record

When the agent reads the vault (for `/augmentiq recall` or migration), it:

1. Walks the vault, skipping `.obsidian/`, `.augmentiq/`, and
   non-AugmentIQ files (those without an `id:` field in the frontmatter).
2. For each AugmentIQ file: parses the YAML frontmatter, reads the body.
3. Builds the AugmentIQ Context Record from the parsed data.
4. Uses the embedding_ref to load the embedding from
   `~/.augmentiq/embeddings/<id>.json` (if present).

---

## The folder structure

AugmentIQ creates the following folder structure on first write:

```
vault_root/
  .augmentiq/
    config.yaml         # the user's AugmentIQ config (mirrored to ~/.augmentiq/config.yaml)
    crons.yaml          # the cron registry
    embeddings/         # the agent-generated embeddings (one file per record)
    logs/               # scheduler logs (for cron-fired actions)
  augmentiq/            # the records
    public/
    internal/
    confidential/
    restricted/
      organisation/     # scope
        email-gmail-personal/
          abc123-okr-draft.md
          def456-reply.md
        local-files-obsidian/
          xyz789-meeting-notes.md
    ingest/             # in-progress and recently-completed batches (transient)
    archive/            # archived records (past retention, kept per policy)
  .obsidian/            # user's Obsidian config (untouched)
```

**The user can rename or relocate these folders** via
`/augmentiq reconfigure --tier=memory`. The agent writes the new config
and future records go to the new location. Existing records are not moved
automatically (the user can move them manually or run a migration).

---

## Search via Dataview (a common Obsidian plugin)

Users with the Dataview plugin installed can run queries against
AugmentIQ records. Examples:

```dataview
TABLE classification, timestamp
FROM "augmentiq/confidential"
WHERE contains(tags, "okrs")
SORT timestamp DESC
```

```dataview
LIST
FROM "augmentiq"
WHERE classification = "restricted"
SORT timestamp DESC
LIMIT 20
```

```dataview
TASK
FROM "augmentiq"
WHERE retention_until < date(today) + dur(30 day)
```

**The third query** finds records expiring in the next 30 days. AugmentIQ's
monthly-retention cron is the source of truth, but the Dataview query
gives the user a real-time view.

---

## Known quirks

### YAML frontmatter special characters

Some content (especially emails and chats) can include special YAML
characters (colons, quotes, newlines, multi-line strings). The agent:

1. Escapes special chars per YAML spec
2. Uses block-scalar style (`|`) for multi-line content
3. Quotes strings that contain `: ` or `#` (YAML comment markers)

### File names

AugmentIQ's filenames are safe (lowercase, hyphenated, ASCII only by
default). If the record's content has non-ASCII characters in the title,
the agent uses the record id (UUID) as the filename, with the title
embedded in the frontmatter.

### Folder structure migration

When the user changes `memory_partition_strategy`, AugmentIQ does not
automatically move existing files. The user can:

1. Run `/augmentiq migrate` to a different backend and back (moves
   records to the new structure in the target, then back).
2. Manually move files (the agent's read just reads whatever's in the
   vault, the structure is informational not enforced).
3. Run a custom script (the user can write their own, the agent does
   not need to do it).

### Attachments

Obsidian's attachment folder is `attachments/` (configurable). AugmentIQ:

1. For attached files in the record (e.g., email attachments), writes
   the file to `attachments/<record_id>/<filename>`.
2. In the Markdown body, links the attachment with Obsidian's wiki link
   syntax: `![[<filename>]]`.

### Concurrent edits

If the user edits an AugmentIQ file in Obsidian while the agent is
ingesting:

1. The agent's read may get a partial state.
2. The user's edit may overwrite the agent's future writes.
3. Mitigation: AugmentIQ files have a "do not edit" notice in the
   frontmatter (`augmentiq_locked: true`). Obsidian shows a warning.
   The user can override, but is told it's against best practice.

### Sync conflicts

If the user's vault is synced via iCloud, Dropbox, or similar:

1. AugmentIQ writes are atomic (write to temp file, then rename).
2. Race conditions are rare but possible (two devices writing to the
   same file simultaneously).
3. Mitigation: AugmentIQ uses the record id (UUID) as the disambiguator.
   If a conflict is detected (two records with the same id, different
   content), the agent prefers the latest `timestamp`.

---

## Embeddings

The agent generates embeddings for each record (for semantic search).
The embeddings are stored separately at `.augmentiq/embeddings/<id>.json`
because:

1. Embeddings are large (1-2 KB per record for typical models).
2. Embeddings are not user-readable (vector of floats).
3. Separating them keeps the vault's Markdown files clean.

The frontmatter has `embedding_ref: augmentiq-embeddings/<id>` pointing
to the embedding file.

**The agent uses its native embedding model** (whatever the host agent
provides). AugmentIQ does not embed directly; it calls the agent's
embedding API.

---

## Performance

- **Read**: fast (filesystem, Obsidian's search is fast).
- **Write**: ~5ms per record (file write + frontmatter parse).
- **Search via Dataview**: medium (queries run on the frontmatter,
  results are instant for thousands of records, may slow for >100k).
- **Embedding**: medium (the agent's embedding model is the bottleneck).
  For 1,000 records, ~30 seconds.

---

## The "Obsidian-only" path

If the user has Obsidian and nothing else (no Hermes, no OpenClaw), the
AugmentIQ skill still works, but:

1. The user invokes the agent via the host's CLI/UI (Hermes, OpenClaw,
   Claude Code, etc.).
2. The agent reads/writes the Obsidian vault as the memory backend.
3. The crons are scheduled via the host agent or external scheduler
   (per `references/crons.md`).

**Obsidian is a memory backend, not a host agent.** The user still needs
a host agent to run the crons and execute the commands.

---
