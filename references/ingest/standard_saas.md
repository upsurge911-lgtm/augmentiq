# Legacy Ingest: standard_saas

---

## What this directive does

For sources with `source_category = standard_saas` (Notion, Confluence,
Slack, GitHub, Linear, HubSpot, Asana, Trello, Figma, Loom, and similar
SaaS platforms with public APIs), the agent extracts, classifies,
transforms, and loads via the SaaS provider's API.

`standard_saas` differs from `cloud_storage`:
- The content is **not just files** — it's pages, databases, messages,
  issues, tickets, designs, recordings, etc.
- The format is **platform-specific** (Notion blocks, Slack threads,
  GitHub issues, Linear projects, etc.).
- The data is **typically more structured** than a file dump.

---

## Supported source types

| source_type | Vendor | What gets ingested |
|---|---|---|
| `saas_notion` | Notion | All pages and databases the user has access to |
| `saas_confluence` | Atlassian Confluence (cloud) | All spaces, pages, comments |
| `saas_slack` | Slack | All channels, threads, DMs (with the user; needs DLP approval) |
| `saas_github` | GitHub | All repos, issues, PRs, comments, releases |
| `saas_linear` | Linear | All teams, projects, issues, comments |
| `saas_hubspot` | HubSpot | Contacts, companies, deals, notes, emails |
| `saas_asana` | Asana | All projects, tasks, comments, attachments |
| `saas_trello` | Trello | All boards, lists, cards, comments |
| `saas_figma` | Figma | All files, comments (designs as binary, metadata-only) |
| `saas_loom` | Loom | All videos, transcripts (binary video as metadata; transcript as text) |
| `saas_jira_cloud` | Atlassian Jira (cloud) | All projects, issues, comments |
| `saas_salesforce_small` | Salesforce (small orgs) | Contacts, accounts, opportunities, notes |
| `saas_stripe` | Stripe | Customers, subscriptions, payments, charges |
| `saas_zendesk` | Zendesk | Tickets, comments, attachments |
| `saas_intercom` | Intercom | Conversations, customers, tags |
| `saas_gsuite` | Google Workspace | Gmail, Calendar, Drive (separate sources) |

**For large Salesforce orgs (>50k records), the user should use
`enterprise_platform` and route to customdev@upsurge.ae.**

---

## The directive

The agent follows this sequence for each `standard_saas` source.

### Phase 1: Authentication

Same as `cloud_storage` (OAuth, API key, or service account). Some
specifics:

- **Slack** requires a `bot` OAuth scope with `channels:history`,
  `channels:read`, `groups:history`, `groups:read`, `im:history`,
  `im:read`, `mpim:history`, `mpim:read`. The user must approve the
  scope in Slack's app config.
- **HubSpot** uses OAuth or a Private App access token. Private App is
  preferred for less setup.
- **Notion** uses an internal integration token (the user creates the
  integration in Notion's settings, shares the pages with it).
- **GitHub** uses a Personal Access Token (classic or fine-grained) or
  a GitHub App installation.
- **Salesforce** uses OAuth 2.0 with the `api` and `refresh_token` scopes.

### Phase 2: Discovery

1. Enumerate the resources the user has access to (workspaces, channels,
   repos, projects, etc.).
2. For each top-level resource, list its children.
3. Apply include/exclude patterns (e.g., exclude archived channels,
   exclude private repos the user doesn't want to ingest).
4. Compute the actual `volume_gb` (for binary content) and `item_count`
   (count of records: pages, messages, issues, etc.).

### Phase 3: Per-record processing

For each record:

1. **Fetch the record** via the API.
2. **Format-specific extraction**:
   - **Notion**: convert blocks to Markdown (use the official `@notionhq/client`
     and a blocks-to-Markdown converter like `notion-to-md`).
   - **Confluence**: convert storage format to Markdown (use the
     `confluence-to-md` tool or the API's `body.storage` field parsed).
   - **Slack**: concatenate messages in thread order, with sender,
     timestamp, and reaction metadata.
   - **GitHub**: combine issue/PR body + comments + reviews into one
     Markdown document.
   - **Linear**: combine issue description + comments + linked PRs.
   - **HubSpot**: combine note body + associated contact/company metadata.
3. **Build the AugmentIQ Context Record** with platform-specific
   `provenance`:
   - `provenance.platform`: "notion" | "slack" | "github" | etc.
   - `provenance.url`: deep link to the original record
   - `provenance.author`: the original creator
   - `provenance.last_edited_by`: for audit
4. **Apply PII auto-classification** (same as other categories).
5. **Write to memory backend**.

### Phase 4: Batch logging

Same as other categories. Notable: the `source_id` includes the
platform and a stable resource ID (e.g., `notion_page_id`).

---

## Per-source configuration

```yaml
legacy_sources:
  - source_id: "notion-acme-product"
    source_type: "saas_notion"
    source_category: "standard_saas"
    location: "https://api.notion.com/v1"  # workspace URL
    include_patterns: ["Product/**", "Engineering/**"]
    exclude_patterns: ["Personal/**", "Archive/**"]
    classification_default: "internal"
    transfer_strategy: "nightly_batches"
    batch_size: "medium_1000"
    estimated_completion_date: "2026-08-15"
    include_archived: false
    include_comments: true
    include_attachments: true  # downloads attached files; otherwise metadata-only
```

---

## Platform-specific quirks

### Notion

- **Block-based**: Notion content is a tree of blocks. AugmentIQ flattens
  to Markdown for the record's content, preserves the block structure
  in `provenance.notion_blocks` (JSON).
- **Database rows** are converted to Markdown tables.
- **Linked databases** are followed recursively (with a depth limit,
  default 3, configurable).
- **Permissions**: the user must explicitly share each top-level page
  with the integration. Notion's API cannot list unshared pages.

### Confluence

- **Storage format** is XHTML-like (Atlassian's custom format). AugmentIQ
  converts to Markdown using a converter.
- **Page hierarchy** (parent-child) is preserved in `provenance.confluence_hierarchy`.
- **Space permissions** matter: the agent can only see what the user can.
- **Archived pages** are skipped by default (configurable).

### Slack

- **Channel types**: public, private, DMs, group DMs. Each requires a
  different scope.
- **Threading**: a top-level message + its replies become one record.
  The agent uses the `thread_ts` to group messages.
- **File attachments**: downloaded if `include_attachments: true`, otherwise
  metadata-only (filename, size, mimetype).
- **Reactions and edits**: the latest version is captured. The edit history
  is logged in `provenance.slack_edit_history` (last 10 edits).
- **DLP**: Slack exports require admin approval. The user must request
  the export from their Slack admin if the org has DLP enabled.

### GitHub

- **Repos**: public + private (the token has access to). Archived repos
  are skipped by default.
- **Issues and PRs**: combined into one Markdown doc per PR/issue.
  Comments are appended in chronological order.
- **Releases**: included as separate records.
- **Wikis**: included as separate records per page.
- **Gists**: included if `include_gists: true` (default: false).
- **Binary files in repos**: not ingested (only README, docs, configs).
- **Rate limits**: 5,000 requests / hour for authenticated users.
  AugmentIQ respects this with backoff.

### Linear

- **Workspaces, teams, projects, issues**: all ingested.
- **Cycles**: ingested as separate records with the issues they contain.
- **Comments**: included by default.
- **Attachments**: downloaded if `include_attachments: true`.

### HubSpot

- **Contacts**: ingested with their associated notes, emails, meetings.
- **Companies**: ingested with their contacts and deals.
- **Deals**: ingested with their notes and contacts.
- **PII handling**: HubSpot data is rich in PII. AugmentIQ's classification
  upgrades are aggressive for HubSpot sources (most contacts are forced
  to `confidential` minimum, emails to `restricted`).

### Salesforce (small)

- **Object types**: Contact, Account, Opportunity, Lead, Note, Task, Event.
  Custom objects are also ingested if accessible.
- **Field-level mapping**: each Salesforce field maps to a record
  property. AugmentIQ preserves all standard fields + custom fields
  in `provenance.salesforce_field_<name>`.
- **Relationship traversal**: a Contact's associated Account and
  Opportunities are inlined into the Contact record.
- **PII handling**: same as HubSpot — Salesforce is PII-rich.

---

## Example session

User runs `/augmentiq ingest --source=notion-acme-product`:

1. Agent uses the Notion integration to list accessible pages.
2. Returns 247 pages, 89 databases, 12,400 blocks total, 124 MB.
3. Agent computes estimate: 124 / 0.3 = 413 hours for volume + 12400 / 5000 =
   2.48 hours for items + 6.2 + 1.24 = 422.92 hours, parallel = 211 hours
   wall-clock. **Too long for auto-ingest.**

Wait, this is wrong. Notion's content is mostly text (Markdown after
conversion), not binary volume. The "volume" estimate is misleading
because the API returns compressed block data, not raw file bytes.

For Notion (and similar text-heavy SaaS), the agent should use `item_count`
as the primary metric, not `volume_gb`. The estimator should be
calibrated per-category.

**Action item for v0.1:** the `standard_saas` coefficient table
(per `estimator.md`) needs to be calibrated to use `item_count` as the
primary metric, with `volume_gb` as a secondary sanity check.

**Workaround for the example:** assume `item_count = 247` (pages, the
more meaningful metric) and a per-page size of ~30KB on average after
conversion. Total effective size: 247 * 30 = 7.4 MB. Item_time: 247 / 5000
= 0.05 hours. Volume_time: 0.0074 / 0.3 = 0.025 hours. Total: 0.075 / 2.0
(parallelism) = 0.04 hours. **About 2.5 minutes wall-clock for 247 Notion
pages. That sounds right.**

**Output to user:**
```
Source: notion-acme-product
Volume: 247 pages, ~7.4 MB effective
Strategy: one_shot (estimated 3 minutes wall-clock)
Classification default: internal

Proceed? [y/n]
```

---

## What this directive does NOT do

- It does not handle SaaS platforms without public APIs (e.g., some
  closed-source enterprise tools). Those go to `enterprise_platform`.
- It does not capture per-user access logs. Only the record content.
- It does not preserve the SaaS-specific feature set (e.g., Notion
  databases' formulas, Slack's huddles). It captures the content as
  text; the original interactive features are not preserved.
- It does not delete the source data. AugmentIQ is read-only on
  the source; the user must clean up the source if desired.

---
