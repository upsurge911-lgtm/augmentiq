import { App, TFile, normalizePath } from 'obsidian';
import * as crypto from 'crypto';
import { MemoryStore, AugRecord } from './store';
import { RpcError } from './server';

export interface ToolCtx {
  app: App;
  store: MemoryStore;
  manifest: { version: string };
  settings: { port: number; readOnly: boolean };
  startedAt: number;
  toolCount: number;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any, ctx: ToolCtx) => any | Promise<any>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return crypto.randomUUID();
}

function req(args: any, key: string): any {
  const v = args?.[key];
  if (v === undefined || v === null || v === '') throw new RpcError(-32602, `Missing required argument: ${key}`);
  return v;
}

function assertWrite(ctx: ToolCtx): void {
  if (ctx.settings.readOnly) throw new RpcError(-32002, 'AugmentiQ is in read-only mode; write operations are disabled');
}

function tfile(app: App, p: string): TFile {
  const f = app.vault.getAbstractFileByPath(normalizePath(String(p)));
  if (f instanceof TFile) return f;
  throw new RpcError(-32001, `File not found: ${p}`);
}

function str(v: any): string {
  return String(v);
}

/* ------------------------------------------------------------------ memory */

async function handleMemory(args: any, ctx: ToolCtx): Promise<any> {
  const action = str(req(args, 'action'));
  const store = ctx.store;
  switch (action) {
    case 'remember': {
      assertWrite(ctx);
      const content = str(req(args, 'content'));
      const tags: string[] = (Array.isArray(args.tags) ? args.tags : []).map((t: string) => str(t).toLowerCase());
      if (args.type) tags.push('type:' + str(args.type));
      if (args.importance) tags.push('importance:' + str(args.importance));
      const id = 'augmentiq:' + uuid();
      const record: AugRecord = {
        schema_version: '1.0',
        id,
        timestamp: nowIso(),
        scope: args.scope || 'individual',
        source: args.source || 'manual:mcp:' + new Date().toISOString().slice(0, 10),
        content,
        tags,
        classification: args.classification || 'internal',
        retention_policy: null,
        audit_ref: '',
        provenance: { source_system: 'augmentiq-obsidian-plugin' },
        pii_patterns: [],
        embedding: null,
        embedding_ref: null,
      };
      const entry = store.addAudit('save', 'agent:mcp', id);
      record.audit_ref = entry.id;
      store.putRecord(record);
      return { record_id: id, status: 'ok', recorded_at: record.recorded_at, audit_ref: entry.id };
    }
    case 'recall': {
      const results = store.search(str(args.query || ''), {
        scope: args.scope,
        limit: typeof args.limit === 'number' ? args.limit : 10,
        classifications: args.filters?.classification,
        tags: args.filters?.tags,
      });
      return { records: results.map((x) => x.record), total: results.length, query: str(args.query || '') };
    }
    case 'forget': {
      assertWrite(ctx);
      const id = str(req(args, 'id'));
      if (args.confirm !== true) throw new RpcError(-32602, 'forget requires confirm: true (records are archived, never silently deleted)');
      if (!store.get(id)) throw new RpcError(-32001, `Record not found: ${id}`);
      store.updateRecord(id, (rec) => {
        rec.archived = true;
      });
      store.addAudit('forget', 'agent:mcp', id);
      return { status: 'ok', record_id: id, note: 'archived; excluded from recall; visible to consolidate' };
    }
    case 'health':
      return store.health();
    case 'profile': {
      const f = ctx.app.vault.getAbstractFileByPath('profile.md');
      if (f instanceof TFile) return { profile: await ctx.app.vault.cachedRead(f) };
      return { profile: null, hint: 'No profile.md at the vault root yet. Create one with stable facts about the user.' };
    }
    case 'consolidate':
      return store.consolidate();
    default:
      throw new RpcError(-32602, `Unknown memory action: ${action}`);
  }
}

/* ------------------------------------------------------- contract (5 tools) */

function handleContractAdd(args: any, ctx: ToolCtx): any {
  assertWrite(ctx);
  const record = req(args, 'record');
  if (typeof record !== 'object') throw new RpcError(-32602, 'record must be an object');
  if (!record.content) throw new RpcError(-32602, 'record.content is required');
  record.id = record.id || 'augmentiq:' + uuid();
  record.schema_version = record.schema_version || '1.0';
  record.timestamp = record.timestamp || nowIso();
  record.scope = record.scope || 'individual';
  record.classification = record.classification || 'internal';
  record.tags = Array.isArray(record.tags) ? record.tags : [];
  record.embedding = null;
  record.embedding_ref = null;
  const entry = ctx.store.addAudit('mcp_add', 'agent:mcp', record.id, args.request_id);
  record.audit_ref = record.audit_ref || entry.id;
  ctx.store.putRecord(record);
  return { record_id: record.id, status: 'ok', recorded_at: record.recorded_at };
}

function handleContractSearch(args: any, ctx: ToolCtx): any {
  const filters = args.filters || {};
  if (filters.action) {
    const entries = ctx.store.auditByAction(str(filters.action));
    return { records: entries, total: entries.length, request_id: args.request_id || null };
  }
  const results = ctx.store.search(str(args.query || ''), {
    scope: args.scope,
    limit: typeof args.limit === 'number' ? args.limit : 10,
    classifications: filters.classification,
    tags: filters.tags,
  });
  return { records: results.map((x) => x.record), total: results.length, request_id: args.request_id || null };
}

function handleContractUpdate(args: any, ctx: ToolCtx): any {
  assertWrite(ctx);
  const id = str(req(args, 'record_id'));
  const updates = req(args, 'updates');
  if (!ctx.store.get(id)) throw new RpcError(-32001, `Record not found: ${id}`);
  ctx.store.updateRecord(id, (rec) => {
    if (Array.isArray(updates.tags)) rec.tags = updates.tags.map(str);
    if (updates.classification) rec.classification = str(updates.classification);
    if (updates.redacted === true) rec.content = `[REDACTED — via mcp_update_memory on ${nowIso()}]`;
    if (updates.retention_until) {
      rec.retention_policy = rec.retention_policy || {};
      rec.retention_policy.until = updates.retention_until;
    }
  });
  ctx.store.addAudit('mcp_update', 'agent:mcp', id, args.request_id);
  return { status: 'ok', updated_at: nowIso(), record_id: id };
}

function handleContractDelete(args: any, ctx: ToolCtx): any {
  assertWrite(ctx);
  const id = str(req(args, 'record_id'));
  const del = str(req(args, 'delete_type'));
  if (!['redact', 'destroy', 'erasure'].includes(del)) throw new RpcError(-32602, `Invalid delete_type: ${del}`);
  if (!ctx.store.get(id)) throw new RpcError(-32001, `Record not found: ${id}`);
  if (del === 'redact') {
    ctx.store.updateRecord(id, (rec) => {
      rec.content = `[REDACTED — ${del} on ${nowIso()}]`;
    });
  } else {
    ctx.store.removeRecord(id);
  }
  ctx.store.addAudit(del === 'erasure' ? 'dsr_erasure' : 'mcp_delete', 'agent:mcp', id, args.request_id);
  return { status: 'ok', deleted_at: nowIso(), record_id: id };
}

function handleContractAudit(args: any, ctx: ToolCtx): any {
  const id = str(req(args, 'record_id'));
  const e = ctx.store.latestAuditFor(id);
  if (!e) throw new RpcError(-32001, `Audit entry not found for record: ${id}`);
  return e;
}

/* ------------------------------------------------------------------- vault */

async function handleVault(args: any, ctx: ToolCtx): Promise<any> {
  const action = str(req(args, 'action'));
  const app = ctx.app;
  switch (action) {
    case 'list': {
      const dir = args.directory ? normalizePath(str(args.directory)).replace(/^\/+|\/+$/g, '') : '';
      const all = app.vault.getMarkdownFiles();
      const filtered = all.filter((f) => !dir || f.path === dir || f.path.startsWith(dir + '/'));
      const page = typeof args.page === 'number' ? args.page : 1;
      const pageSize = typeof args.pageSize === 'number' ? args.pageSize : 100;
      const start = (page - 1) * pageSize;
      const slice = filtered.slice(start, start + pageSize);
      return { files: slice.map((f) => ({ path: f.path, name: f.name })), total: filtered.length, page, pageSize };
    }
    case 'read': {
      const f = tfile(app, req(args, 'path'));
      const content = await app.vault.cachedRead(f);
      const lines = content.split('\n');
      const page = typeof args.page === 'number' ? args.page : 1;
      const pageSize = 2000;
      const start = (page - 1) * pageSize;
      return {
        path: f.path,
        page,
        total_lines: lines.length,
        total_pages: Math.max(1, Math.ceil(lines.length / pageSize)),
        content: lines.slice(start, start + pageSize).join('\n'),
      };
    }
    case 'create': {
      assertWrite(ctx);
      const p = normalizePath(str(req(args, 'path')));
      if (app.vault.getAbstractFileByPath(p)) throw new RpcError(-32602, `File already exists: ${p}`);
      await app.vault.create(p, str(req(args, 'content')));
      return { status: 'ok', path: p };
    }
    case 'update': {
      assertWrite(ctx);
      const f = tfile(app, req(args, 'path'));
      await app.vault.modify(f, str(req(args, 'content')));
      return { status: 'ok', path: f.path };
    }
    case 'delete': {
      assertWrite(ctx);
      const f = tfile(app, req(args, 'path'));
      await app.vault.trash(f, true);
      return { status: 'ok', path: f.path, note: 'moved to system trash (never hard-deleted)' };
    }
    case 'search': {
      const q = str(req(args, 'query')).toLowerCase();
      const files = app.vault.getMarkdownFiles().slice(0, 400);
      const matches: any[] = [];
      for (const f of files) {
        const content = await app.vault.cachedRead(f);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            matches.push({ path: f.path, line_number: i + 1, text: lines[i].slice(0, 200) });
            if (matches.length >= 50) break;
          }
        }
        if (matches.length >= 50) break;
      }
      return { matches, scanned: files.length, query: q };
    }
    case 'move': {
      assertWrite(ctx);
      const f = tfile(app, req(args, 'sourcePath'));
      const target = normalizePath(str(req(args, 'targetPath')));
      if (app.vault.getAbstractFileByPath(target)) throw new RpcError(-32602, `Target exists: ${target}`);
      const from = f.path;
      await app.fileManager.renameFile(f, target);
      return { status: 'ok', from, to: target };
    }
    case 'rename': {
      assertWrite(ctx);
      const f = tfile(app, req(args, 'path'));
      const newName = str(req(args, 'newName'));
      const dir = f.parent ? f.parent.path : '/';
      const target = normalizePath((dir === '/' ? '' : dir) + '/' + newName);
      const from = f.path;
      await app.fileManager.renameFile(f, target);
      return { status: 'ok', from, to: target };
    }
    case 'copy': {
      assertWrite(ctx);
      const f = tfile(app, req(args, 'sourcePath'));
      const target = normalizePath(str(req(args, 'targetPath')));
      if (app.vault.getAbstractFileByPath(target)) throw new RpcError(-32602, `Target exists: ${target}`);
      const content = await app.vault.cachedRead(f);
      await app.vault.create(target, content);
      return { status: 'ok', from: f.path, to: target };
    }
    default:
      throw new RpcError(-32602, `Unknown vault action: ${action}`);
  }
}

/* -------------------------------------------------------------------- edit */

async function handleEdit(args: any, ctx: ToolCtx): Promise<any> {
  const action = str(req(args, 'action'));
  const app = ctx.app;
  const f = tfile(app, req(args, 'path'));
  assertWrite(ctx);
  switch (action) {
    case 'append': {
      const content = await app.vault.read(f);
      const add = str(req(args, 'content'));
      await app.vault.modify(f, content === '' || content.endsWith('\n') ? content + add : content + '\n' + add);
      return { status: 'ok', path: f.path, appended_chars: add.length };
    }
    case 'window': {
      const oldText = str(req(args, 'oldText'));
      const newText = str(req(args, 'newText'));
      const content = await app.vault.read(f);
      const idx = content.indexOf(oldText);
      if (idx !== -1) {
        if (content.slice(idx + oldText.length).indexOf(oldText) !== -1)
          throw new RpcError(-32602, 'oldText matches multiple locations — ambiguous, add more context');
        await app.vault.modify(f, content.slice(0, idx) + newText + content.slice(idx + oldText.length));
        return { status: 'ok', path: f.path, mode: 'exact' };
      }
      const fuzzy = new RegExp(
        oldText.trim().split(/\s+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'),
        'i'
      );
      const m = fuzzy.exec(content);
      if (!m) throw new RpcError(-32001, `oldText not found (exact and fuzzy) in ${f.path}`);
      const all = content.match(new RegExp(fuzzy.source, 'gi'));
      if (all && all.length > 1) throw new RpcError(-32602, `oldText matches ${all.length} locations — ambiguous`);
      await app.vault.modify(f, content.slice(0, m.index) + newText + content.slice(m.index + m[0].length));
      return { status: 'ok', path: f.path, mode: 'fuzzy' };
    }
    case 'patch': {
      const targetType = str(req(args, 'targetType'));
      const operation = str(req(args, 'operation'));
      const content = await app.vault.read(f);
      if (targetType === 'heading') {
        const target = str(req(args, 'target')).replace(/^#+\s*/, '');
        const lines = content.split('\n');
        let hIdx = -1;
        let level = 0;
        for (let i = 0; i < lines.length; i++) {
          const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
          if (m && m[2].trim().toLowerCase() === target.toLowerCase()) {
            hIdx = i;
            level = m[1].length;
            break;
          }
        }
        if (hIdx === -1) throw new RpcError(-32001, `Heading not found: ${target}`);
        let end = lines.length;
        for (let i = hIdx + 1; i < lines.length; i++) {
          const m = /^(#{1,6})\s+/.exec(lines[i]);
          if (m && m[1].length <= level) {
            end = i;
            break;
          }
        }
        const add = str(req(args, 'content'));
        if (operation === 'append') lines.splice(end, 0, '', add);
        else if (operation === 'prepend') lines.splice(hIdx + 1, 0, add);
        else if (operation === 'replace') {
          const body = end > hIdx + 1 ? end - (hIdx + 1) : 0;
          lines.splice(hIdx + 1, body, add);
        } else throw new RpcError(-32602, `Unknown patch operation: ${operation}`);
        await app.vault.modify(f, lines.join('\n'));
        return { status: 'ok', path: f.path, heading: target, operation };
      }
      if (targetType === 'frontmatter') {
        if (operation !== 'replace') throw new RpcError(-32602, 'frontmatter patch supports operation "replace" (upsert) only');
        const key = str(req(args, 'target'));
        const value = str(req(args, 'content'));
        const lines = content.split('\n');
        const hasFm = lines[0] === '---';
        let end = -1;
        if (hasFm) {
          for (let i = 1; i < lines.length; i++)
            if (lines[i] === '---') {
              end = i;
              break;
            }
          if (end === -1) throw new RpcError(-32602, 'Malformed frontmatter block');
        }
        let replaced = false;
        if (hasFm) {
          for (let i = 1; i < end; i++) {
            const m = /^([A-Za-z0-9_-]+):(.*)$/.exec(lines[i]);
            if (m && m[1] === key) {
              lines[i] = `${key}: ${value}`;
              replaced = true;
              break;
            }
          }
          if (!replaced) lines.splice(end, 0, `${key}: ${value}`);
        } else {
          lines.unshift('---', `${key}: ${value}`, '---');
        }
        await app.vault.modify(f, lines.join('\n'));
        return { status: 'ok', path: f.path, key, upserted: true };
      }
      throw new RpcError(-32602, `Unsupported targetType: ${targetType} (use window for blocks)`);
    }
    default:
      throw new RpcError(-32602, `Unknown edit action: ${action}`);
  }
}

/* ------------------------------------------------------------------- graph */

function handleGraph(args: any, ctx: ToolCtx): any {
  const action = str(req(args, 'action'));
  const app = ctx.app;
  const resolved = app.metadataCache.resolvedLinks as Record<string, Record<string, number>>;
  const unresolved = app.metadataCache.unresolvedLinks as Record<string, Record<string, number>>;
  switch (action) {
    case 'forwardlinks': {
      const f = tfile(app, req(args, 'path'));
      return {
        path: f.path,
        forwardlinks: Object.keys(resolved[f.path] || {}),
        unresolved: Object.keys(unresolved[f.path] || {}),
      };
    }
    case 'backlinks': {
      const f = tfile(app, req(args, 'path'));
      const back: string[] = [];
      for (const src of Object.keys(resolved)) if (src !== f.path && resolved[src][f.path]) back.push(src);
      return { path: f.path, backlinks: back };
    }
    case 'neighbors': {
      const f = tfile(app, req(args, 'path'));
      const outgoing = Object.keys(resolved[f.path] || {});
      const incoming: string[] = [];
      for (const src of Object.keys(resolved)) if (src !== f.path && resolved[src][f.path]) incoming.push(src);
      return { path: f.path, outgoing, incoming };
    }
    case 'traverse': {
      const start = tfile(app, req(args, 'path')).path;
      const maxDepth = typeof args.maxDepth === 'number' ? args.maxDepth : 2;
      const maxNodes = typeof args.maxNodes === 'number' ? args.maxNodes : 50;
      const visited = new Set<string>([start]);
      const out: { path: string; depth: number; via?: string }[] = [{ path: start, depth: 0 }];
      let frontier = [start];
      for (let d = 1; d <= maxDepth && out.length < maxNodes; d++) {
        const next: string[] = [];
        for (const cur of frontier) {
          for (const link of Object.keys(resolved[cur] || {})) {
            if (!visited.has(link) && out.length + next.length < maxNodes) {
              visited.add(link);
              next.push(link);
              out.push({ path: link, depth: d, via: cur });
            }
          }
        }
        frontier = next;
        if (!frontier.length) break;
      }
      return { start, nodes: out, count: out.length };
    }
    case 'path': {
      const src = tfile(app, req(args, 'sourcePath')).path;
      const dst = tfile(app, req(args, 'targetPath')).path;
      const parents = new Map<string, string | null>();
      parents.set(src, null);
      let queue = [src];
      let found = false;
      while (queue.length && !found) {
        const next: string[] = [];
        for (const cur of queue) {
          for (const link of Object.keys(resolved[cur] || {})) {
            if (!parents.has(link)) {
              parents.set(link, cur);
              if (link === dst) {
                found = true;
                break;
              }
              next.push(link);
            }
          }
          if (found) break;
        }
        queue = next;
      }
      if (!parents.has(dst)) return { found: false, source: src, target: dst };
      const chain: string[] = [];
      let cur: string | null = dst;
      while (cur !== null) {
        chain.unshift(cur);
        cur = parents.get(cur) ?? null;
      }
      return { found: true, path: chain, length: chain.length - 1 };
    }
    default:
      throw new RpcError(-32602, `Unknown graph action: ${action}`);
  }
}

/* ------------------------------------------------------------------ system */

async function handleSystem(args: any, ctx: ToolCtx): Promise<any> {
  const action = str(req(args, 'action'));
  if (action === 'info')
    return {
      name: 'augmentiq',
      kind: 'obsidian-plugin-embedded-mcp',
      version: ctx.manifest.version,
      vault: ctx.app.vault.getName(),
      port: ctx.settings.port,
      read_only: ctx.settings.readOnly,
      tools: ctx.toolCount,
      records: ctx.store.count(),
      uptime_seconds: Math.floor((Date.now() - ctx.startedAt) / 1000),
    };
  if (action === 'commands')
    return {
      commands: [
        { id: 'copy-token', name: 'Copy bearer token' },
        { id: 'show-status', name: 'Show status' },
        { id: 'regenerate-token', name: 'Regenerate bearer token' },
      ],
    };
  throw new RpcError(-32602, `Unknown system action: ${action}`);
}

/* ---------------------------------------------------------------- registry */

export const TOOLS: ToolDef[] = [
  {
    name: 'memory',
    description:
      'Core memory operations: recall (lexical semantic search), remember (typed record), forget (archive with confirm), health (stats + audit chain verification), profile (read profile.md), consolidate (non-destructive analysis).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['recall', 'remember', 'forget', 'health', 'profile', 'consolidate'] },
        query: { type: 'string', description: 'recall: search query' },
        content: { type: 'string', description: 'remember: what to remember' },
        id: { type: 'string', description: 'forget: record id' },
        confirm: { type: 'boolean', description: 'forget: must be true' },
        type: { type: 'string', enum: ['observation', 'conclusion', 'preference', 'instruction', 'summary'] },
        importance: { type: 'integer', minimum: 1, maximum: 5 },
        scope: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        classification: { type: 'string', enum: ['public', 'internal', 'confidential', 'restricted'] },
        limit: { type: 'integer' },
      },
      required: ['action'],
    },
    handler: handleMemory,
  },
  {
    name: 'vault',
    description:
      'Vault file operations: list, read (paginated), create, update, delete (to trash, never hard delete), search (line matches), move, rename, copy.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'read', 'create', 'update', 'delete', 'search', 'move', 'rename', 'copy'] },
        path: { type: 'string' },
        directory: { type: 'string', description: 'list: folder filter' },
        content: { type: 'string' },
        query: { type: 'string', description: 'search: query text' },
        sourcePath: { type: 'string' },
        targetPath: { type: 'string' },
        newName: { type: 'string' },
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
      },
      required: ['action'],
    },
    handler: handleVault,
  },
  {
    name: 'edit',
    description: 'Fine-grained editing: append to a file, window (exact or fuzzy replace), patch (heading or frontmatter).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['append', 'window', 'patch'] },
        path: { type: 'string' },
        content: { type: 'string' },
        oldText: { type: 'string' },
        newText: { type: 'string' },
        operation: { type: 'string', enum: ['replace', 'append', 'prepend'] },
        targetType: { type: 'string', enum: ['heading', 'frontmatter'] },
        target: { type: 'string', description: 'heading text or frontmatter key' },
      },
      required: ['action', 'path'],
    },
    handler: handleEdit,
  },
  {
    name: 'graph',
    description: 'Vault link graph: forwardlinks, backlinks, neighbors, traverse (BFS), path (shortest route).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['forwardlinks', 'backlinks', 'neighbors', 'traverse', 'path'] },
        path: { type: 'string' },
        sourcePath: { type: 'string' },
        targetPath: { type: 'string' },
        maxDepth: { type: 'integer' },
        maxNodes: { type: 'integer' },
      },
      required: ['action', 'path'],
    },
    handler: handleGraph,
  },
  {
    name: 'system',
    description: 'Server info and plugin commands.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['info', 'commands'] },
      },
      required: ['action'],
    },
    handler: handleSystem,
  },
  {
    name: 'mcp_add_memory',
    description: 'Contract tool: add a record. The Skill sends the AugmentIQ Context Record (see references/record-schema.md §1).',
    inputSchema: {
      type: 'object',
      properties: {
        record: { type: 'object', description: 'The AugmentIQ Context Record' },
        audit_hash: { type: 'string' },
        request_id: { type: 'string' },
      },
      required: ['record'],
    },
    handler: handleContractAdd,
  },
  {
    name: 'mcp_search_memory',
    description: 'Contract tool: search records (or the audit timeline via filters.action).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        scope: { type: 'string' },
        filters: { type: 'object', description: 'classification, tags, timestamp_range, source, action' },
        limit: { type: 'integer' },
        request_id: { type: 'string' },
      },
      required: ['query'],
    },
    handler: handleContractSearch,
  },
  {
    name: 'mcp_update_memory',
    description: 'Contract tool: update tags/classification, redact, or set retention_until.',
    inputSchema: {
      type: 'object',
      properties: {
        record_id: { type: 'string' },
        updates: { type: 'object' },
        audit_hash: { type: 'string' },
        request_id: { type: 'string' },
      },
      required: ['record_id', 'updates'],
    },
    handler: handleContractUpdate,
  },
  {
    name: 'mcp_delete_memory',
    description: 'Contract tool: delete_type redact | destroy | erasure (audit hashes preserved).',
    inputSchema: {
      type: 'object',
      properties: {
        record_id: { type: 'string' },
        delete_type: { type: 'string', enum: ['redact', 'destroy', 'erasure'] },
        audit_hash: { type: 'string' },
        request_id: { type: 'string' },
      },
      required: ['record_id', 'delete_type'],
    },
    handler: handleContractDelete,
  },
  {
    name: 'mcp_get_audit_entry',
    description: 'Contract tool: read back the latest hash-chained audit entry for a record.',
    inputSchema: {
      type: 'object',
      properties: {
        record_id: { type: 'string' },
      },
      required: ['record_id'],
    },
    handler: handleContractAudit,
  },
];