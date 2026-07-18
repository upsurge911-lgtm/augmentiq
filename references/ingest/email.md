# Legacy Ingest: email

---

## What this directive does

For sources with `source_category = email` (Gmail, Outlook, IMAP,
Apple Mail exports, generic .mbox files), the agent extracts, classifies,
transforms, and loads email content.

`email` is **the most PII-rich** source category. Almost every email
contains PII (sender, recipients, body content). AugmentIQ's PII
auto-classification is especially aggressive for email.

`email` is also **the highest-volume** category per item, because emails
include headers, body, attachments, and threading metadata.

---

## Supported source types

| source_type | Vendor | Auth method | API |
|---|---|---|---|
| `email_gmail` | Gmail | OAuth 2.0 | Gmail API v1 |
| `email_outlook` | Microsoft Outlook | OAuth 2.0 | Microsoft Graph API |
| `email_imap_generic` | Generic IMAP server | App password or OAuth | IMAP4rev1 |
| `email_apple_mail_export` | Apple Mail (local export) | Local file access | mbox format |
| `email_mbox_file` | Generic .mbox file | Local file access | mbox format |
| `email_pst` | Microsoft Outlook PST (local) | Local file access | PST binary format |
| `email_google_takeout` | Google Takeout export | Local file access | mbox format |

---

## The directive

The agent follows this sequence for each `email` source.

### Phase 1: Authentication (for live sources)

Same as `cloud_storage` and `standard_saas`:
- **Gmail**: OAuth 2.0 with `https://www.googleapis.com/auth/gmail.readonly`.
- **Outlook**: OAuth 2.0 with `Mail.Read` scope.
- **Generic IMAP**: app password (the user must generate one in their
  email provider's settings; the agent never asks for the real password).

### Phase 1b: File loading (for export sources)

For local exports (Apple Mail, Google Takeout, .mbox, .pst):
1. Use the agent's `terminal` or file-read tool to enumerate the export
   directory.
2. For .mbox: parse the file sequentially (mbox is a flat file format).
3. For .pst: use `libpff` (a Python library) to extract messages.
4. Apply include/exclude patterns (e.g., exclude `[Spam]`, exclude
   `noreply@*` senders).

### Phase 2: Per-message processing

For each email message:

1. **Parse the message**:
   - Headers: From, To, Cc, Bcc, Subject, Date, Message-ID, In-Reply-To,
     References (for threading)
   - Body: plain text, HTML (strip tags), or multipart (extract each part)
   - Attachments: filename, size, mimetype, content
2. **Build the AugmentIQ Context Record**:
   - `id`: `augmentiq:<uuid>`
   - `timestamp`: the email's `Date` header
   - `scope`: from config
   - `source`: `email:<source_id>:<message_id>`
   - `content`: the body, with sender, recipients, and subject as
     frontmatter (YAML or JSON)
   - `tags`: from user-defined patterns, plus auto-tags based on
     sender domain, subject keywords
   - `classification`: from `legacy_sources[].classification_default`,
     then PII auto-upgrade
   - `provenance.email_metadata`:
     ```json
     {
       "from": "jane@acme.com",
       "to": ["bob@acme.com"],
       "cc": [],
       "bcc": [],
       "subject": "Q3 OKR draft",
       "date": "2024-07-12T16:45:00Z",
       "message_id": "<abc123@mail.gmail.com>",
       "in_reply_to": "<def456@mail.gmail.com>",
       "thread_id": "thread-789",
       "attachment_count": 2,
       "attachment_names": ["okrs.pdf", "budget.xlsx"]
     }
     ```
3. **Threading**: emails with `In-Reply-To` are linked to the parent
   record via `provenance.email_metadata.thread_id`. The threading is
   recoverable; the parent record's body includes the child references
   (or vice versa, depending on ingestion order).
4. **PII scan**: extremely thorough. Almost all emails will be upgraded
   to `confidential` or `restricted` automatically.
5. **Write to memory backend**.

### Phase 3: Batch logging

Same as other categories.

---

## Per-source configuration

```yaml
legacy_sources:
  - source_id: "gmail-personal"
    source_type: "email_gmail"
    source_category: "email"
    location: "https://gmail.googleapis.com/gmail/v1/users/me"
    include_patterns: ["**"]                  # all by default
    exclude_patterns: ["[Spam]/**", "[Promotions]/**", "[Social]/**"]
    classification_default: "confidential"    # email defaults higher
    transfer_strategy: "nightly_batches"
    batch_size: "large_10000"
    estimated_completion_date: "2026-09-01"
    include_sent: true
    include_drafts: false
    include_trash: false
    include_spam: false
    download_attachments: true
    attachment_size_limit_mb: 25              # skip larger
    auth_method: "oauth"
    auth_secret_ref: "~/.augmentiq/secrets/gmail.acme.json"
```

---

## PII handling

Email is PII-heavy. The default classification for email is
`confidential`, not `internal`. PII auto-upgrade is aggressive:

- Any email with a personal email address (gmail.com, yahoo.com, etc.)
  in From or To: upgrade to `confidential` minimum.
- Any email with a phone number in the body: upgrade to `confidential`.
- Any email with SSN, credit card, or other restricted PII: force
  `restricted`.
- Any email flagged as containing customer PII (e.g., sent from a CRM
  domain): force `restricted`.

**For organisations with GDPR / HIPAA / PCI DSS compliance packs, all
emails are de facto sensitive and get stricter handling.**

---

## Attachment handling

The user can choose:

- **Download and ingest**: attachments are downloaded, content extracted
  (per `local_files` per-format extraction), stored as separate
  records linked to the email via `provenance.attachment_of`.
- **Metadata only**: only filename, size, mimetype are stored in
  `provenance.email_metadata.attachment_names`. The attachment content
  is not in the memory backend.
- **Skip attachments larger than X MB**: user sets a threshold
  (default: 25 MB). Larger attachments are metadata-only.

**Default:** download and ingest, with 25 MB threshold. The user can
override via the source config.

---

## Threading model

Emails with the same `thread_id` (derived from `In-Reply-To` and
`References` headers) are linked. The agent has two threading strategies:

1. **Flatten to one record per thread**: the entire thread becomes one
   record, with all messages in chronological order. Saves space, but
   loses per-message granularity for the user.
2. **One record per message, linked via thread_id**: each email is its
   own record, linked to siblings. More granular, more records.

**Default:** one record per message, linked via thread_id. The user
can override.

**For `/augmentiq recall`:** the recall query returns matching records
in thread order (parent first, then children chronologically).

---

## Performance

- Gmail API: 250 quota units per user per second. The agent's read
  operations cost 5 units each, so the rate is 50 reads/sec, or
  3000 reads/min.
- Outlook API: 30,000 requests / 30 min per user per app (or 10,000
  requests / 10 min for some endpoints).
- IMAP: not published; varies by provider. Generally ~30-60 fetches/min.
- Local mbox/PST: fast (filesystem reads), the bottleneck is parsing
  (PST is binary, slower than mbox).

---

## Known quirks

### Gmail

- **Threading**: Gmail's thread IDs are not the same as the
  `In-Reply-To` chains. AugmentIQ uses both: `In-Reply-To` for
  RFC-standard threading, and the Gmail thread ID for the platform's
  native grouping.
- **Labels**: Gmail labels are translated to `tags`. System labels
  (`INBOX`, `STARRED`, `IMPORTANT`) are prefixed with `gmail:` in the
  tags.
- **Spam and Trash**: skipped by default (configurable).
- **Promotions and Social**: skipped by default (configurable).
- **Sent items**: included by default (configurable to skip).
- **Drafts**: skipped by default (configurable to include; useful for
  capturing the user's draft history).

### Outlook

- **Conversation ID**: Outlook's native threading. AugmentIQ uses
  `conversationId` for grouping.
- **Categories**: translated to `tags` (Outlook's color categories).
- **Importance flag**: stored in `provenance.email_metadata.importance`.
- **Sensitivity flag**: stored in `provenance.email_metadata.sensitivity`
  and used to bump classification (e.g., "Confidential" sensitivity →
  `confidential` minimum).

### Generic IMAP

- **No native threading**: AugmentIQ uses RFC-standard `In-Reply-To`
  and `References` headers. Inconsistent headers (some clients strip
  them) mean some threads may be incomplete.
- **Slow fetches**: IMAP is slow (1-2 sec per fetch). AugmentIQ
  uses parallel connections (configurable, default 4) to speed up.
- **No native label/category support**: tags must be derived from
  IMAP folders (e.g., `INBOX`, `Sent`, custom folders).
- **Server-side rules**: some IMAP servers (e.g., Gmail IMAP) have
  per-folder limits. AugmentIQ handles this with pagination.

### Apple Mail Export (mbox)

- **Local file access required**: the user must provide the export
  path (default `~/Desktop/Mail Exporter.mbox` or similar).
- **mbox format is flat**: all messages in one file. AugmentIQ parses
  sequentially.
- **Encoding**: mbox files can be in any encoding. AugmentIQ detects
  the encoding (via `chardet`) and converts to UTF-8.

### .pst files

- **Binary format**: requires `libpff-python` or similar.
- **Slow parsing**: PST parsing is ~10x slower than mbox.
- **Outlook-specific**: PST files are Microsoft Outlook's archive
  format. May contain calendar items, contacts, and tasks in addition
  to email.
- **Password-protected PSTs**: not supported in v0.1. The user must
  export an unprotected version from Outlook.

---

## Example session

User runs `/augmentiq ingest --source=gmail-personal`:

1. Agent uses Gmail API to list message IDs in the user's mailbox.
2. Returns 24,700 messages across 47 labels, oldest from 2014-03-12.
3. Agent applies include/exclude patterns: 24,200 messages remain
   (excluded 500 spam, 0 trash).
4. Agent computes estimate: 24200 / 5000 (item coefficient) = 4.84 hours
   for items + 2.5 (volume overhead) = 7.34 hours, parallel = 3.67 hours
   wall-clock. **One night fits.**
5. Strategy recommendation: `one_shot` (3.67 hours is on the edge;
   per the decision tree, ≤6 hours wall-clock = `one_shot` is acceptable
   if user is willing to keep the session open).
6. **Confirmation prompt**:
   ```
   Source: gmail-personal
   Volume: 24,200 messages (estimated 4 GB raw, 800 MB after
           attachment extraction)
   Strategy: one_shot (estimated 3.7 hours, your session must stay active)
   Classification default: confidential
   PII: aggressive auto-upgrade applied (most messages will land as
        restricted due to sender/recipient PII)

   Proceed? [y/n]
   ```
7. On confirm: agent starts processing.
8. After 3.7 hours: agent reports
   `24,200 messages succeeded, 12 failed (corrupted), 0 skipped,
   18,200 auto-upgraded to restricted (PII detected)`.
9. Source `ingest_status` transitions to `completed`.

---

## What this directive does NOT do

- It does not capture email server-side metadata (mailbox quotas, server
  logs, admin actions). Only the message content.
- It does not preserve HTML formatting (CSS, images). It strips to text.
- It does not handle email encryption (PGP, S/MIME). If the user has
  encrypted emails, they must decrypt first (or the user provides a
  key passphrase, which the agent uses to decrypt). The decrypted
  content is what gets stored.
- It does not capture drafts unless `include_drafts: true`.

---
