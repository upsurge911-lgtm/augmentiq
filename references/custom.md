# Backend: Custom

---

## What this backend is

For users with an existing memory store (e.g., a custom vector DB, a
custom file format, a legacy system), AugmentIQ can use it as the
backend. The user provides a small adapter script (Python or shell)
that implements 4 functions: `add`, `search`, `update`, `delete`.

**Why custom:** for users who have a specific memory system they
want to keep, or for users with compliance requirements that mandate
a particular backend (e.g., a specific vector DB with specific
encryption).

---

## The adapter contract

The user provides an adapter at `~/.augmentiq/adapters/<backend_name>.py`
(where `<backend_name>` is what the user names the custom backend).
The adapter must implement:

```python
class AugmentIQCustomAdapter:
    def add(self, record: dict) -> str:
        """Add a record to the backend. Return the record id."""
        raise NotImplementedError

    def search(self, query: str, filters: dict = None, limit: int = 10) -> list:
        """Search the backend. Return a list of records."""
        raise NotImplementedError

    def update(self, record_id: str, updates: dict) -> bool:
        """Update a record. Return True if successful."""
        raise NotImplementedError

    def delete(self, record_id: str) -> bool:
        """Delete a record. Return True if successful."""
        raise NotImplementedError
```

**The `record` and updates shape** is the AugmentIQ Context Record
format (per `references/record-schema.md`). The user's adapter
maps that to the user's backend format.

**The `filters` dict** supports the same filter shape as mem0:
classification, scope, tags, timestamp ranges, pii_patterns.

---

## The 4 functions, in detail

### `add(record: dict) -> str`

The agent calls `add` to write a new record. The user's adapter:

1. Receives the AugmentIQ Context Record (as a Python dict).
2. Transforms it to the backend's native format.
3. Writes to the backend.
4. Returns the backend's record id (which the agent stores in
   `record.backend_id` for future updates/deletes).

**The agent expects:**
- Atomic write (either the record is fully written or not at all).
- Idempotency (the same `record.id` written twice is a no-op or an
  update, not a duplicate).

### `search(query: str, filters: dict, limit: int) -> list`

The agent calls `search` to retrieve records. The user's adapter:

1. Receives the query string, the filters, and the limit.
2. Runs the search against the backend.
3. Returns a list of AugmentIQ Context Records (in dict form).

**The agent expects:**
- Results ranked by relevance (the user's adapter handles ranking).
- Filters applied per the AugmentIQ filter spec.
- Limit respected (the user's adapter may return fewer if the
  backend has fewer matches).

### `update(record_id: str, updates: dict) -> bool`

The agent calls `update` to modify a record. The user's adapter:

1. Receives the record id (AugmentIQ's id, or `backend_id` if
   previously returned from `add`).
2. Receives the updates dict (e.g., `{"tags": ["new", "tags"]}`).
3. Applies the updates to the backend.
4. Returns True if successful.

**The agent expects:**
- Updates are partial (only the fields in the updates dict change).
- Updates are atomic.

### `delete(record_id: str) -> bool`

The agent calls `delete` to remove a record. The user's adapter:

1. Receives the record id.
2. Deletes the record from the backend.
3. Returns True if successful.

**The agent expects:**
- Deletion is permanent (no soft-delete unless the user implements
  it in the adapter).
- Deletion is atomic.

---

## Example: a custom file-based adapter

The user wants to use a custom Markdown format (different from
Obsidian) as the backend. The adapter:

```python
import os
import yaml
from pathlib import Path
from datetime import datetime

class CustomMarkdownAdapter:
    def __init__(self, vault_path: str):
        self.vault_path = Path(vault_path)
        self.vault_path.mkdir(parents=True, exist_ok=True)

    def add(self, record: dict) -> str:
        # Custom format: <classification>/<YYYY-MM-DD>/<safe_title>.md
        date_str = record['timestamp'][:10]  # YYYY-MM-DD
        classification = record['classification']
        safe_title = record['id'].replace('augmentiq:', '')[:12]
        file_path = self.vault_path / classification / date_str / f"{safe_title}.md"

        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, 'w') as f:
            f.write("---\n")
            yaml.dump(record, f, default_flow_style=False)
            f.write("---\n\n")
            f.write(record['content'])

        return record['id']

    def search(self, query, filters=None, limit=10):
        results = []
        for md_file in self.vault_path.rglob("*.md"):
            with open(md_file) as f:
                content = f.read()
            if query.lower() in content.lower():
                # parse and add to results
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    metadata = yaml.safe_load(parts[1])
                    metadata['content'] = parts[2].strip()
                    results.append(metadata)
                    if len(results) >= limit:
                        break
        return results

    def update(self, record_id, updates):
        # Find the file with the matching id, apply updates
        for md_file in self.vault_path.rglob("*.md"):
            with open(md_file) as f:
                content = f.read()
            if record_id in content:
                # parse, update, write back
                # (simplified — production code should be more robust)
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    metadata = yaml.safe_load(parts[1])
                    metadata.update(updates)
                    with open(md_file, 'w') as f:
                        f.write("---\n")
                        yaml.dump(metadata, f, default_flow_style=False)
                        f.write("---\n\n")
                        f.write(metadata.get('content', ''))
                return True
        return False

    def delete(self, record_id):
        for md_file in self.vault_path.rglob("*.md"):
            with open(md_file) as f:
                content = f.read()
            if record_id in content:
                md_file.unlink()
                return True
        return False
```

**This is a minimal example.** Production adapters should handle
errors, concurrency, atomic writes, etc.

---

## The user's responsibilities

When using a custom backend, the user is responsible for:

1. **Implementing the 4 functions** correctly.
2. **Testing the adapter** before running AugmentIQ in production.
3. **Securing the backend** (auth, encryption, access control).
4. **Backing up the backend** (AugmentIQ's export can capture
   the records, but the user must also back up the backend's
   native format).
5. **Migrating** if the user wants to switch backends.

**AugmentIQ cannot help with #2, #3, #4, or #5** — the user owns
the custom backend. AugmentIQ is the layer that uses it.

---

## Error handling

If the user's adapter throws an exception, AugmentIQ's behavior:

1. The exception is caught and logged to the timeline with
   `action: "adapter_error"`.
2. The agent retries up to 3 times with exponential backoff.
3. On final failure, the action is marked failed in the timeline,
   and the user is alerted.
4. The user can fix the adapter and re-run the action.

**Common adapter errors:**
- `add` returns None instead of a record id → agent treats as
  failure, surfaces to user.
- `search` returns records not in AugmentIQ format → agent
  surfaces the malformed records, asks the user to fix the adapter.
- `update` returns False → agent surfaces the failure.
- `delete` returns False → agent surfaces the failure.

---

## When to use the custom backend

- **Existing memory system** the user wants to keep.
- **Specific compliance requirements** that mandate a particular
  backend.
- **Custom vector DB** with specific encryption or hosting.
- **Legacy system** the user wants to integrate with AugmentIQ.

## When NOT to use the custom backend

- **Standard use case** (use Obsidian, mem0, Hermes native, etc.).
- **User without Python/shell scripting ability** (the adapter
  must be implemented).
- **Production deployment without testing** (adapters can be subtle).

---

## Versioning

The adapter contract is versioned. The current version is `1.0`. The
agent includes the version in the call:

```python
# In AugmentIQ's call to the adapter
self.adapter_version = "1.0"
```

If the agent's adapter contract changes (e.g., adds a new parameter
to `search`), the version is bumped. The user's adapter can
explicitly check the version and refuse incompatible calls.

---

## What this backend does NOT do

- It does not provide a UI. The user interacts with the agent, not
  with the custom backend.
- It does not validate the adapter's behavior. The user is responsible
  for testing.
- It does not handle migrations to/from the custom backend. The user
  can use `/augmentiq migrate` with a custom adapter on both sides,
  but the mapping is the user's responsibility.

---
