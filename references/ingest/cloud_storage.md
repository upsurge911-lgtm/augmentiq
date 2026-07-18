# Legacy Ingest: cloud_storage

---

## What this directive does

For sources with `source_category = cloud_storage` (Google Drive, Dropbox,
OneDrive, iCloud Drive, Box, SharePoint Online, generic S3), the agent
extracts, classifies, transforms, and loads via the cloud provider's API.

`cloud_storage` is **slower** than `local_files` because:
- API rate limits apply
- Authentication is required (OAuth, API key, or service account)
- The agent must paginate (most APIs return 100-1000 items per page)

---

## Supported source types

| source_type | Vendor | Auth method | API |
|---|---|---|---|
| `cloud_google_drive` | Google Drive | OAuth 2.0 | Drive API v3 |
| `cloud_dropbox` | Dropbox | OAuth 2.0 | Dropbox API v2 |
| `cloud_onedrive` | Microsoft OneDrive | OAuth 2.0 | Microsoft Graph API |
| `cloud_icloud_drive` | Apple iCloud Drive | App-specific password (CloudKit, read-only) | iCloud Drive API |
| `cloud_box` | Box | OAuth 2.0 | Box API |
| `cloud_sharepoint_online` | Microsoft SharePoint Online | OAuth 2.0 (via Microsoft Graph) | Graph API |
| `cloud_s3_generic` | AWS S3 (or compatible: MinIO, R2, GCS) | Access key + secret | S3 API |

---

## The directive

The agent follows this sequence for each `cloud_storage` source.

### Phase 1: Authentication

1. **Detect available auth.** Check the agent's environment for:
   - OAuth tokens in the agent's secure credential store
   - API keys in `~/.augmentiq/secrets/<source>.env` (read with the agent's
     file-read tool, never echo)
   - Service account credentials at well-known paths (e.g.,
     `~/.config/gcloud/application_default_credentials.json`)
2. **If no auth available:** refuse to proceed, instruct the user to run
   `augmentiq auth <source_id>` (the auth flow is host-specific; the
   skill doesn't dictate it).
3. **If auth available but invalid:** mark source `auth_failed`, alert
   user, log to timeline.

### Phase 2: Discovery

1. Enumerate the source's top-level folder structure via the API's
   `list` or `search` endpoint.
2. Build a file list with metadata: `(id, name, size, mtime, type)`.
3. Filter by user-defined include/exclude patterns.
4. Compute the actual `volume_gb` and `item_count` via the API's
   `about` endpoint (or by summing per-file sizes).
5. If actual volume is much larger than the user's estimate, warn
   before proceeding.

### Phase 3: Per-file processing

For each file:

1. **Download the file** via the API's `get` endpoint.
2. **Detect the format** from the file extension or content-type.
3. **Extract content** per format (same as `local_files`).
4. **Build the AugmentIQ Context Record** (same shape).
5. **Write to memory backend** (same as `local_files`, but may be slower
   if the memory backend is also cloud-based).

### Phase 4: Batch logging

Same as `local_files`.

---

## API rate limits

Each cloud provider has its own rate limits. The agent respects them:

| Provider | Read limit | Pagination size | Notes |
|---|---|---|---|
| Google Drive | 12,000 requests / 60 sec per user | 1000 items per page | Drive API quota |
| Dropbox | varies by endpoint, ~600 / min for most | 2000 items per page | Per-app rate limit |
| OneDrive | 10,000 requests / 10 min per user | 200 items per page | Throttling returns 429 |
| iCloud | not published; conservative | not published | App-specific password limits |
| Box | varies by endpoint, ~1000 / min | 1000 items per page | Per-user rate limit |
| SharePoint Online | 600 requests / 60 sec per user | 5000 items per page | Microsoft Graph throttling |
| S3 | 3,500 PUT / sec, 5,500 GET / sec per account | 1000 keys per `ListObjectsV2` | Account-level limit |

**The agent implements exponential backoff** on 429 (Too Many Requests)
responses. The retry is automatic and doesn't count as a "failure" in
the batch log.

**The batch size is constrained** by the rate limit: for a source with
600 / min and a 6-hour nightly window, the max batch is 600 * 60 * 6 =
216,000 items. The agent uses a conservative fraction of this (1/3 to 1/2)
to leave headroom.

---

## Per-source configuration

```yaml
legacy_sources:
  - source_id: "sharepoint-marketing"
    source_type: "cloud_sharepoint_online"
    source_category: "cloud_storage"
    location: "https://acme.sharepoint.com/sites/marketing/Shared Documents"
    include_patterns: ["**/*.docx", "**/*.pdf", "**/*.md", "**/*.xlsx"]
    exclude_patterns: ["**/Archive/**", "**/~$*"]
    classification_default: "confidential"
    transfer_strategy: "nightly_batches"
    batch_size: "medium_1000"
    estimated_completion_date: "2026-08-15"
    auth_method: "oauth"
    auth_secret_ref: "~/.augmentiq/secrets/sharepoint.acme.json"  # token file
```

---

## Known quirks

### Google Drive

- **Shared drives** require the `supportsAllDrives=true` query parameter.
  Without it, the API returns only the user's personal drive.
- **Trashed files** are returned unless `trashed=false` is specified.
  AugmentIQ defaults to `trashed=false`.
- **Native Google formats** (Docs, Sheets, Slides) need an export step
  (e.g., Docs → `.docx`). AugmentIQ handles this automatically, but
  the export quota is separate from the read quota.

### Dropbox

- **Path-based access** is deprecated. Use file IDs.
- **Cursor-based pagination** is required for large folders (the legacy
  `path` parameter is limited).
- **Hash collisions** on large folders: AugmentIQ uses `content_hash` to
  dedup across runs.

### OneDrive

- **Delta queries** are the most efficient way to sync large drives.
  AugmentIQ uses delta queries for re-runs (only fetches changed files).
- **Permission inheritance** from SharePoint: the agent may see files it
  doesn't have read access to (returned as `accessDenied`). AugmentIQ
  logs these as `auth_failed` per file, continues.

### iCloud Drive

- **No official API.** AugmentIQ uses the `pyicloud` library (a
  community-maintained wrapper) or the `icloudpd` (if installed).
  Reliability is lower than other providers.
- **App-specific passwords** are required (not the user's iCloud password).
  The user must generate one in Apple's account settings.

### Box

- **File IDs are opaque** (numeric). AugmentIQ caches the path→ID mapping
  to handle renames.
- **Comments and tasks** are not included in the file metadata. Only the
  file content is.

### SharePoint Online

- **Site IDs** are required for some endpoints. The agent resolves
  `<hostname>/sites/<sitename>` to a site ID before listing files.
- **Column-level metadata** (e.g., the SharePoint "Status" field) is
  exposed via the Graph API but is not a standard file attribute.
  AugmentIQ captures it in `provenance.sharepoint_metadata` if available.

### S3 (generic)

- **Prefixes**: the user must specify a prefix (folder path) or
  `*` for the entire bucket.
- **Versioning**: if the bucket has versioning enabled, AugmentIQ captures
  the latest version. Older versions are logged but not ingested (configurable).
- **Large buckets** (1M+ objects) require pagination via `ContinuationToken`.
  AugmentIQ handles this.

---

## Example session

User runs `/augmentiq ingest --source=sharepoint-marketing`:

1. Agent resolves the SharePoint site ID via Graph API.
2. Agent lists the folder: 8,400 files, 12.3 GB, oldest mtime 2018-09-04.
3. Agent computes estimate: 12.3 / 0.4 = 30.75 hours for volume + 8400 / 5000 =
   1.68 hours for items + 0.5 + 0.84 = 33.77 hours, parallel = 8.4 hours
   wall-clock.
4. Strategy recommendation: `nightly_batches`, `medium_1000` per night
   (6 hours per night window), 9 nights.
5. **Confirmation prompt**:
   ```
   Source: sharepoint-marketing
   Volume: 12.3 GB, 8,400 items
   Strategy: nightly_batches of medium_1000 items, 6 hours per night
   Estimated: 9 nights, completion by 2026-07-25
   Classification default: confidential

   Proceed? [y/n]
   ```
6. On confirm: agent schedules the `ingest-batch` cron.
7. Each night, the cron pulls 1,000 items, processes them, writes
   to the memory backend, logs the batch.

---

## What this directive does NOT do

- It does not preserve file revisions beyond the latest.
- It does not preserve sharing permissions. The AugmentIQ record has
  no concept of "who can see this file." Access control is at the
  memory backend level.
- It does not capture comments, tasks, or version history. Only the
  file's content as of the latest mtime.
- It does not handle encryption-at-rest differently from the source.
  If the source is encrypted (e.g., S3 with SSE-KMS), AugmentIQ
  decrypts as part of the download; the record is stored in the
  memory backend's native format (which may be unencrypted).
  **The user must ensure the memory backend meets the same encryption
  requirements as the source.**

---
