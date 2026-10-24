# Cron Templates

Per-host starting points for the 6 AugmentIQ cadences
(`references/crons.md` has the full patterns). The agent substitutes
the placeholder values during `/augmentiq init` — `<ANGLE_BRACKETS>`
in YAML/JSON/systemd files, `{{DOUBLE_BRACES}}` in the XML plist.

| File | Host | Mechanism |
|---|---|---|
| `hermes.yaml` | Hermes | Native YAML cron (`~/.hermes/cron/augmentiq-*.yaml`) |
| `openclaw.json` | OpenClaw | Gateway automations (cron schedule + agent turn payload) |
| `launchd.plist` | macOS (any CLI host) | launchd job (Claude Code, Codex CLI, Cursor CLI wrappers) |
| `augmentiq-daily.service` + `augmentiq-daily.timer` | Linux (any CLI host) | systemd units |

Notes:
- Hosts with a native scheduler (Hermes, OpenClaw) use their own format.
- Hosts without one (Claude Code, Codex, Cursor) get a wrapper that
  calls the host CLI with the AugmentIQ command, scheduled by launchd
  or systemd.
- The 6 cadences: daily-snapshot (02:00), weekly-review (Sun 04:00),
  monthly-retention (1st 03:00), quarterly-audit (quarter-end 04:00),
  ingest-batch (02:00 nightly if pending), on-event (manual/triggered).