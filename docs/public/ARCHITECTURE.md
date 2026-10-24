# AugmentIQ Architecture

**Status:** DRAFT v0.1

```
┌─────────────────────┐      ┌───────────────────────────┐      ┌─────────────────────┐
│     Host Agent      │      │      AugmentIQ Skill      │      │    Memory Backend   │
│                     │      │  (portable, Agent Skills  │      │                     │
│  Hermes · OpenClaw  │◄────►│   standard, MIT)          │◄────►│  AugmentIQ+ (MCP,   │
│  Claude Desktop/Code│      │                           │      │   Docker) ⭐ rec.   │
│  Codex · Cursor     │      │  · formats Records        │      │  Obsidian · mem0    │
│  30+ spec hosts     │      │  · enforces 5 Principles  │      │  ReMe · Hermes      │
│                     │      │  · 26 subcommands         │      │  native             │
└─────────────────────┘      │  · routing + governance   │      └─────────────────────┘
                             └───────────────────────────┘
```

## The layers

1. **The Skill** — the governance layer. Installed on any Agent-Skills-compliant host. Formats the AugmentIQ Context Record, enforces the 5 Immutable Principles, exposes 26 subcommands (init, capture, recall, audit, dsr, migrate, ingest, destroy…). It is host- and backend-agnostic.

2. **The Backends** — where records live:
   - **AugmentIQ+** — Docker-based MCP server, 100% local, server-owned tamper-evident audit (SQLite hash chain), hybrid search (BM25 + dense), bi-temporal stamping. Recommended for serious / enterprise / local-first use.
   - **Obsidian, mem0, ReMe, Hermes native** — governance over infrastructure you already have.
   - **Obsidian plugin (planned)** — consumer product: an Obsidian plugin with an **embedded** MCP server (127.0.0.1:3710, bearer token). One install, zero external services. The skill drives it like any backend.

3. **The Host Agent** — keeps full authority. The skill suggests, confirms, and audits; the agent (and its human) decide.

## Product lines

| Line | What | Status |
|---|---|---|
| Governance skill | This repo, installable everywhere | v0.1 (nearly done) |
| Consumer product | Obsidian plugin + embedded MCP server | Planned (build in progress) |
| Enterprise backend | AugmentIQ+ Docker MCP server | Skeleton exists, later |
| OpenClaw plugin | Native tools + bundled skill for OpenClaw | Planned |