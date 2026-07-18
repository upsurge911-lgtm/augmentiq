# PII Auto-Classification Patterns

---

## What this document does

When a record is created (via capture, ingest, or migration), the agent
scans its content for PII patterns. If patterns are found, the record's
classification is auto-upgraded per the rules below.

This document specifies:
1. The PII patterns (regex + heuristics)
2. The classification upgrade rules
3. The per-regulation overlays (GDPR, HIPAA, PCI DSS)
4. The false-positive handling

---

## The PII patterns

Each pattern has:
- **Name** — used in tags and audit logs
- **Regex** — the matching pattern
- **Validation** — additional checks (e.g., Luhn for credit cards)
- **Default classification upgrade** — what classification to apply when this pattern is detected
- **False positive risk** — how often this pattern matches non-PII content

### Pattern 1: Email address

| Property | Value |
|---|---|
| Name | `email` |
| Regex | `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/` |
| Validation | basic RFC 5322 shape |
| Default upgrade | `internal` (if currently `public`), else no change |
| False positive risk | low (very specific pattern) |

### Pattern 2: Phone number

| Property | Value |
|---|---|
| Name | `phone` |
| Regex | `/\b(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}\b/` |
| Validation | digit count between 7 and 15 |
| Default upgrade | `internal` (if currently `public`), else no change |
| False positive risk | medium (matches dates, IDs, and other numbers) |

### Pattern 3: SSN (US Social Security Number)

| Property | Value |
|---|---|
| Name | `ssn` |
| Regex | `/\b\d{3}-\d{2}-\d{4}\b/` |
| Validation | none (3-2-4 format is highly specific) |
| Default upgrade | `restricted` (always) |
| False positive risk | low |

### Pattern 4: National ID (configurable per region)

| Property | Value |
|---|---|
| Name | `national_id` |
| Regex | region-specific: `/\b[A-Z]{2}\d{6,8}\b/` (example: UK National Insurance) |
| Validation | configurable per region |
| Default upgrade | `restricted` (always) |
| False positive risk | medium (depends on region) |

### Pattern 5: Credit card number

| Property | Value |
|---|---|
| Name | `credit_card` |
| Regex | `/\b(?:\d[ -]*?){13,19}\b/` |
| Validation | **Luhn check required** (mod 10 algorithm) |
| Default upgrade | `restricted` (always) |
| False positive risk | low (Luhn filter is very specific) |
| Note | if PCI DSS is in the user's regulations, escalate to special handling |

### Pattern 6: Bank account / IBAN

| Property | Value |
|---|---|
| Name | `bank_account` |
| Regex | `/\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/` (IBAN) or `/\b\d{8,12}\b/` (US routing+account) |
| Validation | IBAN check digits (mod 97) for IBANs |
| Default upgrade | `restricted` (always) |
| False positive risk | medium |

### Pattern 7: IP address

| Property | Value |
|---|---|
| Name | `ip_address` |
| Regex | `/\b(?:\d{1,3}\.){3}\d{1,3}\b/` (IPv4) or `/\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/` (IPv6) |
| Validation | octet range check (0-255) for IPv4 |
| Default upgrade | `internal` (if currently `public`), else no change |
| False positive risk | medium (matches version numbers, etc.) |

### Pattern 8: Physical address (heuristic)

| Property | Value |
|---|---|
| Name | `physical_address` |
| Regex | combination of street keywords + number + zip-code-like pattern |
| Validation | street keyword list (Street, St, Avenue, Ave, Road, Rd, etc.) |
| Default upgrade | `internal` (if currently `public`), else no change |
| False positive risk | high (heuristic, lots of false positives) |
| Note | only flagged if both a street keyword AND a number pattern are present |

### Pattern 9: Date of birth (heuristic)

| Property | Value |
|---|---|
| Name | `dob` |
| Regex | date patterns combined with DOB/DOB:/Birth/Born keywords |
| Validation | keyword + date pattern |
| Default upgrade | `restricted` (under HIPAA, GDPR) |
| False positive risk | high |

### Pattern 10: Medical record number (HIPAA)

| Property | Value |
|---|---|
| Name | `medical_record_number` |
| Regex | pattern depends on EMR system; default: `/\bMRN[:\s-]?\d{6,10}\b/` |
| Validation | configurable per EMR |
| Default upgrade | `restricted` (always, especially under HIPAA) |
| False positive risk | low |

### Pattern 11: Passport number

| Property | Value |
|---|---|
| Name | `passport` |
| Regex | `/\b[A-Z]{1,2}\d{6,9}\b/` |
| Validation | country-specific |
| Default upgrade | `restricted` (always) |
| False positive risk | medium |

### Pattern 12: Driver's license

| Property | Value |
|---|---|
| Name | `drivers_license` |
| Regex | `/\bDL[:\s-]?[A-Z0-9]{6,12}\b/` |
| Validation | state/country-specific |
| Default upgrade | `restricted` (always) |
| False positive risk | medium |

---

## The classification upgrade rules

When a record is being written (via capture, ingest, or migration):

1. Start with the record's default classification (per
   `legacy_sources[].classification_default` or the user's save-time choice).
2. Run all PII patterns against the content.
3. For each pattern that matches:
   - If the pattern's default upgrade is `restricted`, force classification
     to `restricted` (regardless of the default).
   - If the pattern's default upgrade is `internal`, only upgrade if the
     current classification is `public` (downgrade prevention is the goal).
4. If multiple patterns match, the highest-required classification wins
   (i.e., `restricted` overrides `confidential` overrides `internal` overrides
   `public`).
5. The detected patterns are stored in the record's `pii_patterns` field
   for audit and future re-classification.

**Example 1:** Record content is "Q3 revenue: $2.4M, headcount 14, contact:
jane@acme.com." Default classification is `internal`. Detected: `email`.
Upgrade: `internal` → `internal` (no change, email is internal-level).

**Example 2:** Record content is "Customer SSN: 123-45-6789, address: ..."
Default classification is `confidential`. Detected: `ssn`, `physical_address`.
Upgrade: `confidential` → `restricted` (SSN forces restricted).

**Example 3:** Record content is "Marketing email list: jane@x.com, bob@y.com,
carol@z.com." Default classification is `public`. Detected: `email`.
Upgrade: `public` → `internal` (email upgrades from public to internal).

---

## Per-regulation overlays

The user's `regulations[]` configuration may add stricter rules.

### GDPR overlay (when `regulations` includes `gdpr`)

- Any record with EU-citizen-identifiable PII (national_id, IBAN, EU phone
  format) is forced to `restricted`.
- Any record with `dob` (date of birth) is forced to `restricted`.
- Any record with `email` is `internal` minimum (even if default is `public`).
- Records with these patterns are tagged with `gdpii:<pattern_type>` for
  easy filtering.

### HIPAA overlay (when `regulations` includes `hipaa`)

- Any record with `medical_record_number`, `dob`, or any of the 18 HIPAA
  identifiers is ePHI (electronic Protected Health Information).
- All ePHI records are forced to `restricted`.
- ePHI records are tagged with `ephi:<pattern_type>`.
- ePHI records are excluded from any default export (only DSR-fulfilling
  exports can include them, with explicit logging).

### PCI DSS overlay (when `regulations` includes `pci_dss`)

- Any record with `credit_card` (after Luhn check) is CHD (Cardholder Data).
- CHD records are forced to `restricted`.
- CHD records are tagged with `pci:<last4>:<bin>` (last 4 of card + bank
  identification number, NOT the full PAN).
- CHD records are excluded from any default export. Only PCI-compliant
  systems can access them.

### SOC2 overlay (when `regulations` includes `soc2`)

- No PII upgrade changes (SOC2 is about access controls, not data classification).
- However, all PII detections are logged to the timeline as "PII access events"
  for SOC2 CC6.1 (logical access controls).

### ISO 27001 overlay (when `regulations` includes `iso27001`)

- Same as SOC2: PII detections are logged per A.9.4 (information access
  restriction).

---

## False-positive handling

PII patterns can match non-PII content (e.g., a phone number pattern matches
"2024-01-15" in a date). The user has the right to override any auto-classification
upgrade:

1. The agent shows the record, the detected patterns, and the proposed classification.
2. The user can:
   - Accept the upgrade (default, Enter)
   - Override: "This is not PII; classify as <lower level>"
3. The override is logged to the timeline with `action: "pii_override"` and
   the user's reasoning (optional, 1-line text).
4. The override does not delete the detection log — the audit trail
   records both the auto-detection and the override.

**The override is per-record, not per-pattern.** If a record has 3 PII
patterns and the user overrides 1, the other 2 still apply.

---

## What the PII detection does NOT do

- It does not extract or store the actual PII values. The patterns are
  matched, the classification is applied, the count is logged, but the
  regex match itself is not persisted (only the count).
- It does not call external services for verification (e.g., it doesn't
  call a credit card validator API). The Luhn check is local.
- It does not handle non-Latin scripts (Arabic, Chinese, Cyrillic) by
  default. v1.0 supports Latin-script PII only. Other scripts are flagged
  for the future.
- It does not detect PII in images, audio, or other binary content.
  Records that include such content are flagged for manual review.

---

## Performance and limits

- The PII patterns run on every record write. For a 1KB record, the scan
  takes <1ms. For a 1MB record (e.g., a long email), it takes <100ms.
- The patterns are case-insensitive by default.
- Unicode normalisation is applied before scanning (NFC form).
- Records with >10MB content are split into chunks for scanning; results
  are aggregated.

---
