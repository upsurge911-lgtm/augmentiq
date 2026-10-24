import * as http from 'http';
import * as crypto from 'crypto';

/** JSON-RPC error carrying one of the AugmentIQ contract codes (record-schema.md §4). */
export class RpcError extends Error {
  code: number;
  data?: any;
  constructor(code: number, message: string, data?: any) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

const MAX_BODY = 10 * 1024 * 1024;

/**
 * Minimal stateless MCP server over streamable HTTP.
 * Binds 127.0.0.1 only. Bearer-token auth on every /mcp request.
 */
export class AugMcpServer {
  private srv: http.Server | null = null;

  constructor(
    private getToken: () => string,
    private handle: (msg: any) => Promise<any>,
    private serverInfo: { name: string; version: string; vaultName: () => string }
  ) {}

  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const srv = http.createServer((req, res) => {
        void this.onRequest(req, res);
      });
      srv.on('error', (err: any) => {
        this.srv = null;
        reject(err);
      });
      srv.listen(port, '127.0.0.1', () => {
        this.srv = srv;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    const srv = this.srv;
    this.srv = null;
    if (!srv) return;
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }

  private cors(res: http.ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID, X-Api-Key'
    );
  }

  private sendJson(res: http.ServerResponse, status: number, body: any) {
    const text = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(text);
  }

  private authorized(req: http.IncomingMessage): boolean {
    const hdr = req.headers['authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(String(hdr));
    if (!m) return false;
    const got = Buffer.from(m[1]);
    const want = Buffer.from(this.getToken());
    if (got.length !== want.length) return false;
    return crypto.timingSafeEqual(got, want);
  }

  private async onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    this.cors(res);
    const url = String(req.url || '/');
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'GET' && url === '/health') {
        this.sendJson(res, 200, {
          status: 'ok',
          server: this.serverInfo.name,
          vault: this.serverInfo.vaultName(),
        });
        return;
      }
      if (url !== '/mcp') {
        this.sendJson(res, 404, { error: 'not found' });
        return;
      }
      if (req.method !== 'POST') {
        this.sendJson(res, 405, { error: 'method not allowed' });
        return;
      }
      if (!this.authorized(req)) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        this.sendJson(res, 401, {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32002, message: 'Unauthorized: missing or invalid bearer token' },
        });
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BODY) {
          this.sendJson(res, 413, { error: 'payload too large' });
          return;
        }
        chunks.push(chunk as Buffer);
      }
      let raw: any;
      try {
        raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        this.sendJson(res, 200, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        return;
      }

      const msgs: any[] = Array.isArray(raw) ? raw : [raw];
      const wasSingleNotification =
        !Array.isArray(raw) && (typeof raw !== 'object' || raw === null || raw.id === undefined);
      const results: any[] = [];
      for (const m of msgs) results.push(await this.handleMessage(m));

      if (wasSingleNotification) {
        res.writeHead(202);
        res.end();
        return;
      }
      this.sendJson(res, 200, Array.isArray(raw) ? results : results[0]);
    } catch (err: any) {
      this.sendJson(res, 200, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal error', data: String(err?.message || err) },
      });
    }
  }

  private async handleMessage(msg: any): Promise<any> {
    if (msg === null || typeof msg !== 'object' || typeof msg.method !== 'string') {
      return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid request' } };
    }
    const id = msg.id ?? null;
    if (msg.id === undefined) return undefined; // notification
    try {
      let result: any;
      if (msg.method === 'initialize') {
        result = {
          protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: this.serverInfo.name, version: this.serverInfo.version },
        };
      } else if (msg.method === 'ping') {
        result = {};
      } else {
        result = await this.handle(msg);
      }
      return { jsonrpc: '2.0', id, result };
    } catch (err: any) {
      if (err instanceof RpcError) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: err.code, message: err.message, ...(err.data !== undefined ? { data: err.data } : {}) },
        };
      }
      return { jsonrpc: '2.0', id, error: { code: -32603, message: 'Internal error', data: String(err?.message || err) } };
    }
  }
}