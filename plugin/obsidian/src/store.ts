import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface AugRecord {
  [k: string]: any;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  record_id: string;
  previous_hash: string;
  audit_hash: string;
  request_id: string;
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The memory store: `.augmentiq/` in the vault.
 * - memories.jsonl — one AugmentIQ Context Record per line
 * - audit.log — the hash-chained, append-only timeline (record-schema.md §2)
 *
 * The timeline is server-owned (this plugin is the server): every mutation
 * appends an audit entry whose hash chains onto the previous one.
 */
export class MemoryStore {
  private dir: string;
  private memPath: string;
  private auditPath: string;
  private records = new Map<string, AugRecord>();
  private order: string[] = [];
  private audit: AuditEntry[] = [];
  private lastHash = 'genesis';

  constructor(vaultPath: string) {
    this.dir = path.join(vaultPath, '.augmentiq');
    this.memPath = path.join(this.dir, 'memories.jsonl');
    this.auditPath = path.join(this.dir, 'audit.log');
  }

  load(): void {
    fs.mkdirSync(this.dir, { recursive: true });
    if (fs.existsSync(this.memPath)) {
      const text = fs.readFileSync(this.memPath, 'utf8');
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
          const r = JSON.parse(t);
          this.records.set(r.id, r);
          this.order.push(r.id);
        } catch {
          /* skip corrupt line */
        }
      }
    }
    if (fs.existsSync(this.auditPath)) {
      const text = fs.readFileSync(this.auditPath, 'utf8');
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
          this.audit.push(JSON.parse(t));
        } catch {
          /* skip */
        }
      }
      if (this.audit.length) this.lastHash = this.audit[this.audit.length - 1].audit_hash;
    }
  }

  count(): number {
    return this.records.size;
  }

  get(id: string): AugRecord | undefined {
    return this.records.get(id);
  }

  putRecord(record: AugRecord): void {
    record.recorded_at = record.recorded_at || nowIso();
    if (!this.records.has(record.id)) this.order.push(record.id);
    this.records.set(record.id, record);
    this.persistRecords();
  }

  updateRecord(id: string, mutate: (r: AugRecord) => void): AugRecord {
    const r = this.records.get(id);
    if (!r) throw new Error(`record not found: ${id}`);
    mutate(r);
    this.persistRecords();
    return r;
  }

  removeRecord(id: string): void {
    this.records.delete(id);
    this.order = this.order.filter((x) => x !== id);
    this.persistRecords();
  }

  private persistRecords(): void {
    const lines: string[] = [];
    for (const id of this.order) {
      const r = this.records.get(id);
      if (r) lines.push(JSON.stringify(r));
    }
    fs.writeFileSync(this.memPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  }

  addAudit(action: string, actor: string, recordId: string, requestId?: string): AuditEntry {
    const id = 'augmentiq-tl:' + crypto.randomUUID();
    const timestamp = nowIso();
    const rid = requestId || id;
    const canonical = JSON.stringify({
      id,
      timestamp,
      action,
      actor,
      record_id: recordId,
      previous_hash: this.lastHash,
      request_id: rid,
    });
    const audit_hash = sha256(canonical);
    const entry: AuditEntry = {
      id,
      timestamp,
      action,
      actor,
      record_id: recordId,
      previous_hash: this.lastHash,
      audit_hash,
      request_id: rid,
    };
    this.lastHash = audit_hash;
    this.audit.push(entry);
    fs.appendFileSync(this.auditPath, JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  latestAuditFor(recordId: string): AuditEntry | undefined {
    for (let i = this.audit.length - 1; i >= 0; i--) {
      if (this.audit[i].record_id === recordId) return this.audit[i];
    }
    return undefined;
  }

  auditByAction(action: string): AuditEntry[] {
    return this.audit.filter((e) => e.action === action);
  }

  verifyChain(): { ok: boolean; checked: number; broken_at?: string } {
    let prev = 'genesis';
    for (const e of this.audit) {
      const canonical = JSON.stringify({
        id: e.id,
        timestamp: e.timestamp,
        action: e.action,
        actor: e.actor,
        record_id: e.record_id,
        previous_hash: prev,
        request_id: e.request_id,
      });
      if (sha256(canonical) !== e.audit_hash) return { ok: false, checked: this.audit.length, broken_at: e.id };
      if (e.previous_hash !== prev) return { ok: false, checked: this.audit.length, broken_at: e.id };
      prev = e.audit_hash;
    }
    return { ok: true, checked: this.audit.length };
  }

  publicView(r: AugRecord): AugRecord {
    const { embedding, embedding_ref, ...rest } = r;
    return rest;
  }

  /** Lexical search (D5: lexical first; local embeddings arrive behind a flag in v1.1). */
  search(
    query: string,
    opts: { scope?: string; limit?: number; classifications?: string[]; tags?: string[]; includeArchived?: boolean }
  ): { score: number; record: AugRecord }[] {
    const q = String(query || '').toLowerCase();
    const terms = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    const limit = opts.limit ?? 10;
    const results: { score: number; record: AugRecord }[] = [];
    const now = Date.now();
    for (const id of this.order) {
      const r = this.records.get(id);
      if (!r) continue;
      if (r.archived && !opts.includeArchived) continue;
      if (opts.scope && r.scope !== opts.scope) continue;
      if (opts.classifications && opts.classifications.length && !opts.classifications.includes(r.classification)) continue;
      if (opts.tags && opts.tags.length && !(opts.tags as string[]).every((t) => (r.tags || []).includes(t))) continue;
      const content = String(r.content || '').toLowerCase();
      let score = 0;
      for (const t of terms) {
        let idx = 0;
        let n = 0;
        while ((idx = content.indexOf(t, idx)) !== -1) {
          n++;
          idx += t.length;
        }
        score += n;
      }
      for (const tag of r.tags || []) {
        if (terms.includes(String(tag).toLowerCase())) score += 3;
      }
      const imp = (r.tags || []).find((t: string) => String(t).startsWith('importance:'));
      if (imp) score += 2 * (parseInt(String(imp).split(':')[1], 10) || 3);
      const ts = Date.parse(r.timestamp || r.recorded_at || nowIso());
      if (!isNaN(ts)) {
        const ageDays = (now - ts) / 86400000;
        score += Math.max(0, 2 - ageDays / 30);
      }
      if (terms.length === 0 || score > 0) results.push({ score, record: this.publicView(r) });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  health(): any {
    const by: Record<string, number> = {};
    let archived = 0;
    let oldest: string | null = null;
    const contentHashes = new Set<string>();
    let duplicates = 0;
    for (const r of this.records.values()) {
      if (r.archived) archived++;
      const t = (r.tags || []).find((x: string) => String(x).startsWith('type:'));
      const key = t || 'untyped';
      by[key] = (by[key] || 0) + 1;
      const ts = r.timestamp || r.recorded_at;
      if (ts && (!oldest || ts < oldest)) oldest = ts;
      const h = sha256(String(r.content || '').trim().toLowerCase());
      if (contentHashes.has(h)) duplicates++;
      else contentHashes.add(h);
    }
    return {
      total: this.records.size,
      active: this.records.size - archived,
      archived,
      by_type: by,
      oldest,
      exact_duplicates: duplicates,
      chain: this.verifyChain(),
    };
  }

  /** Non-destructive analysis; the agent/user resolves candidates through the write tools. */
  consolidate(): any {
    const staleDays = 90;
    const now = Date.now();
    const stale: string[] = [];
    const dupPairs: { ids: string[]; reason: string }[] = [];
    const seen = new Map<string, string>();
    for (const id of this.order) {
      const r = this.records.get(id);
      if (!r || r.archived) continue;
      const ts = Date.parse(r.timestamp || r.recorded_at || '');
      if (!isNaN(ts) && (now - ts) / 86400000 > staleDays) stale.push(id);
      const h = sha256(String(r.content || '').trim().toLowerCase());
      if (seen.has(h)) dupPairs.push({ ids: [seen.get(h) as string, id], reason: 'exact content match' });
      else seen.set(h, id);
    }
    return {
      mode: 'non-destructive analysis',
      exact_duplicate_pairs: dupPairs,
      stale_record_ids: stale,
      health: this.health(),
      next_step:
        'Resolve candidates via memory.forget / mcp_update_memory (or keep them). This tool never mutates records on its own (Principle 1).',
    };
  }
}