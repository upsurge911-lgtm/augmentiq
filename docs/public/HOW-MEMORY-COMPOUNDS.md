# How a vault becomes a memory that compounds

Most "AI memory" products store chat history and call it memory. That produces recall without understanding: you can find what was said, but the system never forms a view.

AugmentiQ does something different. It treats your vault as a substrate and applies a memory loop to it, so that what accumulates is not a transcript but a body of structured belief — dated, classified, sourced, and auditable.

This document explains the mechanism, because the honest version is more interesting than the marketing version.

---

## 1. The raw material: a vault is already a mind

Anyone with an Obsidian vault has been doing knowledge work for years. The problem is that the structure is latent, not usable:

- Notes describe **events** ("met the supplier, they quoted 12k")
- Notes describe **decisions** ("going with option B because lead time matters more than price")
- Notes describe **beliefs** ("the Dubai market rewards speed over polish")
- Notes describe **preferences** ("he hates long emails")

But they are prose. An agent reading a note sees text. It does not see *a decision that constrains future options*, or *a preference that should change how it writes*.

AugmentiQ's first job is to make that distinction explicit.

## 2. The four layers

```
┌──────────────────────────────────────────────────────────────┐
│  L4  Profile        stable, curated facts about the person   │
│      profile.md     name, role, hard preferences, red lines  │
├──────────────────────────────────────────────────────────────┤
│  L3  Conclusions    beliefs derived from repetition          │
│      type:conclusion  "prefers speed over polish; evidence:  │
│                       three decisions in six weeks"          │
├──────────────────────────────────────────────────────────────┤
│  L2  Observations   dated facts and events, as they happen   │
│      type:observation  "quoted 12k for the Al Quoz fit-out"  │
├──────────────────────────────────────────────────────────────┤
│  L1  Vault          the notes themselves — the substrate     │
│      .md files       never overwritten by the memory system  │
└──────────────────────────────────────────────────────────────┘
```

The memory system **reads** L1 and **writes** L2–L4. It never silently rewrites your notes. That is the boundary that makes it safe to point at work you care about.

## 3. How an observation becomes a conclusion

This is the part that distinguishes a memory from a log.

An observation is cheap and disposable: "user asked for the short version again". One of those means nothing. Fifteen across two months mean something — and that something is a *conclusion*, which is a different and far more useful kind of record.

Consolidation is where this happens. Run weekly, it:

1. **Groups** observations by shared tags and scope
2. **Detects repetition** — the same finding observed N times
3. **Proposes a conclusion** — the generalisation the repetition supports
4. **Flags contradictions** — a newer observation that contradicts an older belief
5. **Surfaces staleness** — beliefs that no longer match recent evidence
6. **Proposes profile updates** — conclusions stable enough to become standing facts

Crucially, step 3 and 6 **propose rather than apply**. The consolidation report is a document you read, and the agent applies what you accept. This is Principle 2 in practice: the system suggests, you decide.

## 4. Why this makes the agent better, not just more informed

Recall alone doesn't improve output. What improves output is **recall that changes decisions**.

Three concrete mechanisms:

**Fewer wasted turns.** The agent stops asking for context it already has. On a project with a month of memory, the first three exchanges of every session are no longer spent re-establishing what is going on.

**Better default assumptions.** When the profile says "prefers directness, dislikes preamble", every response is shorter and denser without being told. When a conclusion says "this market rewards speed", proposals lead with timelines rather than features.

**Compounding research.** This is the big one. A research task with memory can be decomposed: agent A investigates suppliers, agent B investigates regulation, agent C investigates competitors — each writing structured Markdown into the vault rather than holding findings in context. The synthesis step then reads *documents*, not token soup.

Without memory, that architecture is impossible. Each sub-agent's output dies with its session. With memory, the swarm's work lands somewhere durable, reviewable, and diffable — and the next investigation starts from it.

## 5. What "structured" actually means on disk

Every memory is a record with the same shape:

```json
{
  "id": "augmentiq:9c1f2a34-…",
  "timestamp": "2026-10-24T14:00:00Z",
  "recorded_at": "2026-10-24T14:00:03Z",
  "scope": "individual",
  "source": "chat:session:2026-10-24",
  "content": "Quoted 12k AED for the Al Quoz fit-out, 6-week lead time.",
  "tags": ["supplier", "fit-out", "al-quoz", "type:observation"],
  "classification": "confidential",
  "audit_ref": "augmentiq-tl:4e8b1c22-…"
}
```

Four properties do the work:

**Bi-temporal.** `timestamp` is when the fact happened; `recorded_at` is when it was stored. Six months later you can ask "what did I believe in March, and when did I learn otherwise" — a question a single-timestamp store cannot answer.

**Classified.** `confidential` on a supplier quote means consolidation can surface it to you but the agent won't paste it into an external draft. Classification is what makes an audit trail meaningful rather than decorative.

**Sourced.** `source` and `provenance` record where the claim came from. "The agent thinks X" is worth much less than "the agent thinks X, from this conversation, on this date".

**Audit-referenced.** Every record points at a timeline entry whose hash chains to the one before it. You can prove the order of events without trusting the agent's account of them.

## 6. What the audit chain is actually for

It is tempting to dismiss hash chains as compliance theatre. In this system it answers one real question:

> *Did the agent know this before it made that recommendation?*

Without a chain, an agent can reconstruct a plausible story after the fact, and you cannot tell memory from rationalisation. With a chain, the record's existence at a moment in time is fixed by a hash that cannot be recomputed differently.

That is why the chain is server-owned rather than agent-maintained. An agent that can edit its own audit trail has no audit trail.

## 7. How it grows

The system is designed so that **effort invested early reduces effort later**, which is the opposite of how most AI tooling behaves.

- **Week 1:** the store is nearly empty. Recall adds little. The agent is effectively stateless.
- **Week 3:** first conclusions appear. Responses start landing without preamble.
- **Week 8:** the profile is stable. The agent stops asking things it should know.
- **Month 6:** consolidation has resolved dozens of contradictions. The record is a defensible account of what the project believed at each stage.

The curve is real but it is not instant, and any product claiming instant value from memory is selling autocomplete.

## 8. What it deliberately does not do

- **It does not summarize your notes.** Your notes stay yours; the memory layer records *about* them.
- **It does not decide what is true.** It records what was observed and what was concluded, with dates and sources, and lets you adjudicate.
- **It does not replace retrieval.** Lexical recall in v0.1; local embeddings behind a flag in v1.1. Retrieval improves the loop but the loop is the product.
- **It does not run when Obsidian is closed.** The server lives in the app. This is a real limitation and it is stated plainly rather than hidden in a footnote.

## 9. The one-sentence version

AugmentiQ turns a vault of prose into a dated, classified, auditable record of what an agent has learned — so that each session starts from accumulated belief rather than from zero, and each investigation makes the next one cheaper.
