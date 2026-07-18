# Backend: ReMe

---

## What this backend is

ReMe is a file-based memory layer with:

- Files as the source of truth (Markdown + YAML, like Obsidian)
- Git-style versioning (every change is a commit)
- A changelog and time-travel support
- Search via a local index
- Optional sync to a remote (for multi-device use)

**Why ReMe:** for users who want the audit-trail guarantees of a versioned
system (compliance), without the cost of a vector DB.

**Status:** ReMe is a community-maintained project. The exact API and
install path may shift. AugmentIQ treats it as a Tier 3 backend (early,
expect minor compatibility work).

---

## Detection

The agent detects ReMe by:

1. Looking for `.reme/` config directory in a parent folder.
2. Looking for `reme.toml` or similar config files.
3. Asking the user to confirm the install location.

---

## Install path

ReMe is a CLI tool. The user installs it:

```bash
# pip (if ReMe is on PyPI)
pip install reme

# or via cargo (if ReMe is in Rust)
cargo install reme

# or via npm
npm install -g reme
```

**Source for install:** ReMe's docs (verify the exact install path
when implementing; this is a placeholder).

---

## The record transformation

ReMe uses files as the source of truth. The transformation is similar to
Obsidian (Markdown with YAML frontmatter) but with a few differences:

- Every change is a commit (the agent uses ReMe's `commit` command
  after each write).
- The changelog is the audit trail (no separate `timeline/`).
- The version history is queryable (the user can see all previous
  versions of a record).

**The mapping:**

| AugmentIQ field | ReMe equivalent |
|---|---|
| `record.id` | filename or frontmatter `id` field |
| `record.content` | file body |
| `record.timestamp` | file's mtime (ReMe tracks this per commit) |
| `record.tags` | YAML frontmatter `tags` field |
| `record.classification` | YAML frontmatter `classification` field |
| `record.audit_ref` | ReMe commit hash |
| `record.provenance` | YAML frontmatter `provenance` field |
| `record.embedding` | Not stored by default (ReMe is not a vector DB) |

**The `embedding` field:** ReMe does not have native vector search. For
semantic search, the agent must:

1. Generate embeddings externally (using the agent's native embedding
   model).
2. Store the embeddings in a sidecar file (`.reme/embeddings/<id>.json`).
3. Search via the sidecar (linear scan or external vector index).

This adds complexity. ReMe is best for users who prioritize the
versioning + audit trail over semantic search.

---

## Native API operations

ReMe's CLI (or library) provides:

| Operation | Command | Notes |
|---|---|---|
| **Add file** | `reme add <file>` | stages a file |
| **Commit** | `reme commit -m "<message>"` | creates a commit |
| **Search** | `reme search <query>` | keyword search via the local index |
| **History** | `reme log <file>` | shows commits for a file |
| **Diff** | `reme diff <file> <commit1> <commit2>` | shows differences |
| **Restore** | `reme checkout <file> <commit>` | restores a previous version |

**Source for the API:** ReMe's docs.

---

## Known quirks

### Commit cadence

The agent's writes can be frequent (per record, per batch). ReMe's
commits are atomic per file, but creating a commit per record is
expensive (each commit is a filesystem operation + Git object creation).

**Mitigation:** the agent batches writes (commits once per batch, not
once per record). The commit message includes the batch_id and the
list of records written.

### Search

ReMe's search is keyword-based by default (full-text index). For
semantic search, the agent must do the extra work described above.

**For `/augmentiq recall`:** the agent uses ReMe's keyword search for
the first pass, then re-ranks using the sidecar embeddings (if
available).

### Multi-user

ReMe is single-user by default. For multi-user (e.g., a team sharing
a vault), the user must either:

1. Set up a shared filesystem mount (NFS, SMB) — works but has
   concurrency issues.
2. Use ReMe's optional remote sync (if ReMe has it).
3. Run one ReMe per user, with a shared index (custom setup).

AugmentIQ recommends ReMe for individual and small-team use only.

### Backup

ReMe's Git-style versioning IS the backup. Every record's history is
preserved. The user can clone the `.reme/` directory for off-site
backup.

**For compliance:** the agent can include the `.reme/` directory in
the AugmentIQ export (per `/augmentiq export --format=full`), giving
the user a complete backup of the memory backend.

---

## When to recommend ReMe

- **Individual user** with a strong preference for file-based, versioned
  memory.
- **Compliance-conscious user** who values the immutable history
  ReMe provides.
- **Power user** who wants the ability to time-travel through their
  notes.

## When NOT to recommend ReMe

- **Team deployment** with >5 users (concurrency issues).
- **High-volume recall** (semantic search is slower than vector DBs).
- **Cloud-first user** (ReMe is local-first by design; the remote
  sync is not as mature as mem0).

---

## What this backend does NOT do

- It does not provide a UI. The user uses ReMe's CLI or a third-party
  viewer.
- It does not generate embeddings. The agent handles this externally.
- It does not handle multi-user by default. Setup is required.

---
