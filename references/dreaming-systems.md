# Dreaming Systems: Hermes vs. OpenClaw

> **Status:** distilled directive. Sources cited at the bottom. The full
> research note is archived at `dreaming-systems-research.full.md`
> (the prior 511-line version) for anyone who needs the upstream quotes.
>
> **Location in skill package:** `references/dreaming-systems.md` (this
> file). Per-host references are `references/agents/agent-hermes.md` and
> `references/agents/agent-openclaw.md`.

## The directive

**Do not promise "dreaming" or "synthesis" in any AugmentIQ directive.** The host agent's own memory system is the source of truth in v0.1.

| Host agent | Memory model | Dreaming/synthesis? |
|---|---|---|
| **Hermes** | `MEMORY.md` (2200 chars) + `USER.md` (1375 chars), managed by the `memory` tool with `add`/`replace`/`remove`. Loaded as a frozen snapshot at session start. | **No dreaming system.** When memory overflows, the agent consolidates *in the same turn* by removing/replacing entries. There is no separate synthesis pass. |
| **OpenClaw** | `memory/.dreams/` (machine state) + `DREAMS.md` (human diary) + `MEMORY.md` (long-term destination). Managed by the `memory-core` plugin. | **Has dreaming** (light → REM → deep phases, opt-in, disabled by default, configurable cron cadence, weighted ranking of candidate promotions, 6 signals: relevance 0.30, frequency 0.24, query diversity 0.15, recency 0.15, consolidation 0.10, conceptual richness 0.06). |
| **Claude Code, Codex, Cursor, nanobot** | Host-specific; check `references/agents/<name>.md` per host. | None have a documented dreaming system. |

## What this means for AugmentIQ directives

- The skill's directives never say "synthesize," "consolidate," "promote to long-term," or "dream." Those are host-agent concepts.
- The skill's directives say "write a record," "tag a record," "classify a record," "redact a record," "export a record." Those are AugmentIQ concepts.
- If a user asks for a "dream pass" on their Hermes memory, the agent should say: "Hermes doesn't ship a dreaming system. AugmentIQ v0.1 doesn't add one. If you want OpenClaw-style synthesis, the user would need to switch host agents or use a custom adapter."

## Position v0.1 vs. v0.2 (for future reference)

- **v0.1 (now):** no dreaming in AugmentIQ. The host agent's own memory system is the source of truth.
- **v0.2 (later):** adopt the OpenClaw dreaming model (per https://docs.openclaw.ai/concepts/dreaming) and port it to Hermes. This is a 6-12 week project, not a v0.1 deliverable.

## Sources (canonical)

- OpenClaw dreaming doc: https://docs.openclaw.ai/concepts/dreaming (pulled 2026-07-16, 84 KB raw, 14 KB text)
- Hermes Persistent Memory doc: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory (pulled 2026-07-16, 70 KB raw)
- Hermes agent homepage: https://hermes-agent.nousresearch.com/ (pulled 2026-07-16, 94 KB raw)
- Hermes local install: `~/.hermes/config.yaml`, `~/.hermes/SOUL.md` (per the system prompt of every Hermes session)

**End of dreaming-systems.md**
