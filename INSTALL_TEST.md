# Install Test Plan (AugmentIQ v0.0.1-alpha)

> **Status: alpha test plan. Run on every host you target.**
>
> The Skill's behavior in a live session is unverified at the time of
> the v0.0.1-alpha release. This document is the test plan.
>
> **Targets:** Hermes (primary), OpenClaw (secondary). Claude Code,
> Codex, Cursor, nanobot are Tier 3 and not in the v0.0.1-alpha
> acceptance test.

---

## 0. Pre-flight checks (do these before running the test)

These are mechanical and should always pass on a clean install.

```bash
# Check the install directory is present
ls -la ~/.hermes/skills/augmentiq/ 2>/dev/null
# Expect: SKILL.md, references/, assets/, LICENSE, README.md, CHANGELOG.md, PRD.md

# Check the SKILL.md frontmatter
head -3 ~/.hermes/skills/augmentiq/SKILL.md
# Expect: --- / name: augmentiq / description: ... / ---

# Check the references tree
ls ~/.hermes/skills/augmentiq/references/
ls ~/.hermes/skills/augmentiq/references/agents/
ls ~/.hermit/skills/augmentiq/references/ingest/
# (the last one should be 'ingest' not 'hermit' — fix if you see 'hermit')

# Check the questionnaires are real (not placeholders)
for f in individual team department organisation; do
  size=$(stat -f%z ~/.hermes/skills/augmentiq/assets/questionnaires/$f.json)
  echo "$f.json: $size bytes"
done
# Expect: individual ~3.3KB, team ~5.1KB, department ~7.6KB, organisation ~9.3KB
# A 67-75 byte file is a placeholder and means the install is broken.

# Verify Hermes has indexed the skill
hermes skills list | grep augmentiq
# Expect: a line showing 'augmentiq' with status 'enabled' and scope 'local'
```

**If any pre-flight check fails, do not proceed to the functional test.** The failure is in the install, not in the Skill.

---

## 1. The functional test (the part that matters)

Open a new chat in Hermes. In the first message, type the following commands **in order**. For each, verify the response.

### 1.1 `/augmentiq help` — the dispatch test

**Command:** `/augmentiq help`

**Expected behavior:** Hermes loads the SKILL.md, parses the 26-command list, returns the commands grouped by category:
- Onboarding (4): init, status, reconfigure, destroy
- Capture (3): snapshot, save, tag
- Query (3): recall, timeline, who-knows
- Compliance (5): audit, retention, redact, dsr, role
- Migration (3): migrate, export, import
- Legacy ingest (8): ingest + 7 sub-commands
- Meta (1): help

**Pass criteria:** all 26 commands listed. No error. The 5 Immutable Principles are referenced in the help output (or in the response to the next command).

**Fail modes:**
- "Unknown command" or "Skill not found" → the skill didn't load. Fix: `hermes skills reload` or restart Hermes.
- "Parse error" or "Malformed frontmatter" → the install is broken. Re-run the install.

### 1.2 `/augmentiq status` — the read-only test

**Command:** `/augmentiq status`

**Expected behavior:** per Principle 4, this is read-only. No confirmation prompt. The agent should:
- Detect the host (Hermes)
- Detect the memory backend (NOT YET CONFIGURED — fresh install)
- Read `~/.augmentiq/config.yaml` if it exists (it does NOT — fresh install)
- Return: "AugmentIQ is not initialised. Run /augmentiq init to configure."

**Pass criteria:** the agent does NOT auto-trigger `/augmentiq init`. It returns a clear "not initialised" message. (Per the SKILL.md description, the help should "remember this" cases that the user says without a slash command are NOT auto-triggered — but `/augmentiq status` is an explicit command, so it should respond.)

**Fail modes:**
- Agent runs `/augmentiq init` automatically → this is a Principle 4 violation. The agent should not auto-init. The user must explicitly invoke it.
- Agent errors trying to read the config → the agent should handle the missing-file case gracefully.

### 1.3 `/augmentiq init` — the write test (the one that matters)

**Command:** `/augmentiq init`

**Expected behavior:**
1. Agent detects the host (Hermes) and the host's version.
2. Agent asks the tier (individual, team, department, organisation).
3. User picks `individual` (the smallest test path).
4. Agent walks the 5 individual questions from `assets/questionnaires/individual.json`:
   - Q1: name (default: "personal")
   - Q2: memory backend (default: obsidian)
   - Q3: location (default: auto-detect)
   - Q4: auto-classification (default: yes)
   - Q5: when to capture (default: manual_only)
5. After every question, agent shows progress ("5 of 5").
6. After all questions, agent computes cron set (manual_only = no crons).
7. **Per Principle 4, agent shows a confirmation prompt** with the full plan: which crons (none), which sources (none), which compliance features (none), which schedule (manual only).
8. User types `y` or `proceed` to confirm.
9. Agent writes `~/.augmentiq/config.yaml` with the answers.
10. Agent logs init to the timeline (`~/.augmentiq/timeline.jsonl`).
11. Agent returns success message.

**Pass criteria:**
- The 5 questions are asked in order.
- Smart defaults are pre-filled (Enter to accept).
- The confirmation prompt is shown BEFORE writing the config.
- After confirmation, the config file is written.
- The timeline entry is written.
- A success message is returned.

**Fail modes:**
- Agent skips the confirmation prompt → Principle 4 violation. STOP. This is the most important failure to catch.
- Agent asks the questions but doesn't apply smart defaults → bad UX, not a blocker.
- Agent writes the config but doesn't log to the timeline → Principle 5 violation. STOP.
- Agent crashes during write (config partially written, timeline not written) → the agent should detect the partial write and roll back. If it doesn't, the user has to manually delete `~/.augmentiq/config.yaml` and start over.

### 1.4 `/augmentiq status` (post-init) — the verification test

**Command:** `/augmentiq status`

**Expected behavior:** now the config exists. The agent returns a status block:
- Config: `~/.augmentiq/config.yaml` (modified <timestamp>)
- Host: Hermes <version> on <os> (cron capable: yes/no)
- Memory: <backend> at <location>
- Scale: individual (5-question init complete)
- Crons (0 active): [none — manual_only selected]
- Compliance: [none — individual tier default]
- Timeline: <N> events since init

**Pass criteria:** the status block reflects what was configured. The 0-active-crons is correct for the manual_only selection.

### 1.5 `/augmentiq save` — the record-write test

**Command:** `/augmentiq save "test record from install test"`

**Expected behavior:**
1. Agent shows a confirmation prompt with the record preview:
   - About to save 1 record
   - Classification: <default for individual = internal>
   - Tags: []
   - Source: manual
2. User confirms.
3. Agent writes the record to the memory backend.
4. Agent logs the save to the timeline.
5. Agent returns the record id.

**Pass criteria:** the confirmation prompt is shown. The record is written. The timeline entry is written.

**Fail modes:**
- No confirmation prompt → Principle 4 violation.
- Record not actually written (silent failure) → the agent must surface the write success/failure.

### 1.6 `/augmentiq recall` — the read test

**Command:** `/augmentiq recall "test record"`

**Expected behavior:** agent searches the memory backend, returns the matching record(s). For a single test record, the response should be: 1 match, the record id, the record's content snippet.

**Pass criteria:** at least 1 match returned. The match is the record from step 1.5.

### 1.7 `/augmentiq timeline` — the audit log test

**Command:** `/augmentiq timeline --filter=save,init`

**Expected behavior:** agent returns the timeline entries for the init action and the save action. Each entry has: timestamp, action, actor, user_confirmed, record id (for save).

**Pass criteria:** at least 2 entries (init + save). The user_confirmed field is true for both.

### 1.8 `/augmentiq destroy --keep-config` — the teardown test (the read-only teardown)

**Command:** `/augmentiq destroy --keep-config`

**Expected behavior:**
1. Agent shows the first confirmation prompt:
   - This will:
     - Disable 0 crons
     - Stop 0 legacy ingest sources
     - Log the destruction to `~/.augmentiq/destroyed/`
2. User types `destroy` to confirm.
3. Agent shows the second confirmation prompt:
   - This is irreversible (without a backup). Type `destroy-permanently` to confirm.
4. User types `destroy-permanently` to confirm.
5. Agent writes the destruction log to `~/.augmentiq/destroyed/<timestamp>.log`.
6. Agent logs the destruction to the timeline.
7. Config is preserved (--keep-config flag).

**Pass criteria:** both confirmations are required. The destruction log is written. The config is preserved. The timeline entry is written.

**Fail modes:**
- Agent skips the confirmations → Principle 4 violation. STOP.
- Agent deletes the config despite `--keep-config` → catastrophic Principle 4 violation. STOP.
- Agent doesn't write the destruction log → the proof of teardown is missing.

### 1.9 Post-test verification

```bash
# Check the destruction log was written
ls ~/.augmentiq/destroyed/
# Expect: a file named <timestamp>.log

# Check the config is preserved
cat ~/.augmentiq/config.yaml
# Expect: the original config from step 1.3

# Check the timeline is intact
wc -l ~/.augmentiq/timeline.jsonl
# Expect: at least 4 lines (init, save, recall, destroy)

# Check the test record is gone (destroy did not delete it, but verify the user's intent)
# (The test record is in the memory backend, not in AugmentIQ's directory.)
```

---

## 2. The OpenClaw test (secondary)

The OpenClaw test mirrors the Hermes test with these adjustments:
- The install path is `~/.openclaw/workspace/skills/augmentiq/`.
- The cron format is JSON entries in `~/.openclaw/openclaw.json` under the `cron` key (vs Hermes's YAML).
- The slash command dispatch is via OpenClaw's skills loader.
- The memory backend detection may differ (OpenClaw has its own memory system, so the hermes_native detection is irrelevant).

**If the Hermes test passes and the OpenClaw install + dispatch work, the OpenClaw test passes by analogy.** The per-host-agent ref in `references/agents/openclaw.md` documents the per-host specifics.

---

## 3. Pass / fail decision

The v0.0.1-alpha is "release-ready" when:

- All 9 functional tests (1.1 - 1.9) pass on Hermes.
- The pre-flight checks (section 0) all pass.
- No Principle violations observed (no unconfirmed writes, no silent failures, no data loss without explicit destroy).

If any test fails, **do not promote to v0.1.0**. Fix the failure, re-run the failing test, re-run the full suite, then promote.

---

## 4. What this test plan does NOT cover

- **The Custom (AugmentIQ+ MCP) backend** is not tested in this alpha because the AugmentIQ+ MCP server is not yet released (per Antigravity, install path is `docker run -i augmentiq-engine`, but the image is not yet public). When the MCP server is released, add:
  - `/augmentiq init` with `custom` as the backend — verify the Skill launches the MCP server as a subprocess.
  - `/augmentiq save` with Custom backend — verify the Skill calls `mcp_add_memory` and gets a record id back.
  - `/augmentiq recall` with Custom backend — verify the Skill calls `mcp_search_memory` and gets results back.
  - `/augmentiq destroy` with Custom backend — verify the Skill calls `mcp_delete_memory` for each record (or relies on the MCP server's bulk-delete if it has one).

- **The 4 compliance packs** are not tested because they're not yet drafted. When the packs land in v0.1.0, add:
  - GDPR pack: DSR workflow test (`/augmentiq dsr --type=erasure`), retention enforcement test, audit report generation test.
  - SOC2 pack: same as GDPR but with SOC2 control mapping.
  - HIPAA pack: same but with HIPAA identifier detection.
  - ISO 27001 pack: same but with ISO 27001 control mapping.

- **The legacy ingest** is not tested in this alpha because the per-source legacy data is environment-specific. When the migration playbook lands, add per-source tests.

- **The Hermes-native backend** is not tested separately because the Skill's `custom.md` reference documents the contract; the actual Hermes MEMORY.md is the user's personal file.

---

## 5. Reporting failures

If you find a failure, capture:
1. The exact command you ran.
2. The exact error message (verbatim).
3. The state of `~/.augmentiq/` before and after (e.g., `ls -la ~/.augmentiq/`).
4. The relevant timeline entry (e.g., `cat ~/.augmentiq/timeline.jsonl | tail -5`).

Then report to the Skill author (Robin / AugmentIQ maintainer) with the captured state. The Skill author will reproduce the failure, identify the root cause (per the `systematic-debugging` discipline), and ship a fix.

---

**End of install test plan.**
