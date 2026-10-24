import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import * as crypto from 'crypto';
import { AugMcpServer, RpcError } from './server';
import { MemoryStore } from './store';
import { TOOLS, ToolCtx } from './tools';

interface AugmentiQSettings {
  port: number;
  token: string;
  readOnly: boolean;
  serverEnabled: boolean;
}

const DEFAULT_SETTINGS: AugmentiQSettings = {
  port: 3710,
  token: '',
  readOnly: false,
  serverEnabled: true,
};

export default class AugmentiQPlugin extends Plugin {
  settings!: AugmentiQSettings;
  store!: MemoryStore;
  server: AugMcpServer | null = null;
  private statusEl: HTMLElement | null = null;
  private startedAt = Date.now();

  async onload() {
    await this.loadSettings();
    if (!this.settings.token) {
      this.settings.token = crypto.randomBytes(32).toString('hex');
      await this.saveSettings();
      new Notice('AugmentiQ: token generated. Use the ribbon icon or command palette to copy it.');
    }
    const vaultPath = (this.app.vault.adapter as any).basePath as string;
    this.store = new MemoryStore(vaultPath);
    this.store.load();

    this.addRibbonIcon('brain', 'AugmentiQ — copy token', () => this.copyToken());
    this.statusEl = this.addStatusBarItem();
    this.updateStatus();

    this.addCommand({ id: 'copy-token', name: 'Copy bearer token', callback: () => this.copyToken() });
    this.addCommand({ id: 'show-status', name: 'Show status', callback: () => this.showStatus() });
    this.addCommand({
      id: 'regenerate-token',
      name: 'Regenerate bearer token',
      callback: () => void this.regenerateToken(),
    });

    this.addSettingTab(new AugmentiQSettingTab(this.app, this));
    await this.startServer();
  }

  onunload() {
    void this.server?.stop();
    this.server = null;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) || {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private ctx(): ToolCtx {
    return {
      app: this.app,
      store: this.store,
      manifest: { version: this.manifest.version },
      settings: { port: this.settings.port, readOnly: this.settings.readOnly },
      startedAt: this.startedAt,
      toolCount: TOOLS.length,
    };
  }

  private async handleRpc(msg: any): Promise<any> {
    if (msg.method === 'tools/list') {
      return { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) };
    }
    if (msg.method === 'tools/call') {
      const name = msg.params?.name;
      if (!name) throw new RpcError(-32602, 'tools/call requires params.name');
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) throw new RpcError(-32601, `Unknown tool: ${name}`);
      const result = await tool.handler(msg.params?.arguments || {}, this.ctx());
      return { content: [{ type: 'text', text: JSON.stringify(result ?? null) }] };
    }
    throw new RpcError(-32601, `Unknown method: ${msg.method}`);
  }

  async startServer(): Promise<void> {
    await this.server?.stop();
    this.server = null;
    this.updateStatus('starting');
    if (!this.settings.serverEnabled) {
      this.updateStatus('off');
      return;
    }
    const srv = new AugMcpServer(
      () => this.settings.token,
      this.handleRpc.bind(this),
      { name: 'augmentiq', version: this.manifest.version, vaultName: () => this.app.vault.getName() }
    );
    try {
      await srv.start(this.settings.port);
      this.server = srv;
      this.updateStatus('on');
    } catch (e: any) {
      this.server = null;
      this.updateStatus('error');
      new Notice(`AugmentiQ: cannot listen on port ${this.settings.port} — ${e?.code || e?.message || e}`);
    }
  }

  private updateStatus(state?: string) {
    if (!this.statusEl) return;
    const s = state || (this.server ? 'on' : this.settings.serverEnabled ? 'error' : 'off');
    const ro = this.settings.readOnly ? ' 🔒' : '';
    if (s === 'on') this.statusEl.setText(`AugmentiQ:${this.settings.port}${ro}`);
    else if (s === 'off') this.statusEl.setText('AugmentiQ: off');
    else if (s === 'starting') this.statusEl.setText('AugmentiQ: …');
    else this.statusEl.setText('AugmentiQ: ✕');
  }

  copyToken() {
    void navigator.clipboard.writeText(this.settings.token).then(() =>
      new Notice('AugmentiQ token copied — paste into your agent config as the Bearer token')
    );
  }

  showStatus() {
    new Notice(
      `AugmentiQ ${this.manifest.version} · ${this.app.vault.getName()} · ${
        this.server ? 'server on 127.0.0.1:' + this.settings.port : 'server off'
      } · records: ${this.store ? this.store.count() : 0}${this.settings.readOnly ? ' · read-only' : ''}`
    );
  }

  async regenerateToken() {
    this.settings.token = crypto.randomBytes(32).toString('hex');
    await this.saveSettings();
    new Notice('AugmentiQ token regenerated — update your agents');
  }
}

class AugmentiQSettingTab extends PluginSettingTab {
  plugin: AugmentiQPlugin;

  constructor(app: App, plugin: AugmentiQPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'AugmentiQ' });

    new Setting(containerEl)
      .setName('Server enabled')
      .setDesc('Run the embedded MCP server (127.0.0.1 only)')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.serverEnabled).onChange(async (v) => {
          this.plugin.settings.serverEnabled = v;
          await this.plugin.saveSettings();
          await this.plugin.startServer();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName('Port')
      .setDesc('Default 3710. Binds 127.0.0.1 only.')
      .addText((t) =>
        t.setValue(String(this.plugin.settings.port)).onChange(async (v) => {
          const p = parseInt(v, 10);
          if (p > 0 && p < 65536) {
            this.plugin.settings.port = p;
            await this.plugin.saveSettings();
            await this.plugin.startServer();
          }
        })
      );

    new Setting(containerEl)
      .setName('Read-only mode')
      .setDesc('Block all write operations ("we don\'t own your memory")')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.readOnly).onChange(async (v) => {
          this.plugin.settings.readOnly = v;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName('Bearer token')
      .setDesc('The token agents use to authenticate. Keep it private.')
      .addText((t) => t.setValue(this.plugin.settings.token));

    new Setting(containerEl).setName('Copy token').addButton((b) =>
      b.setButtonText('Copy').onClick(() => this.plugin.copyToken())
    );

    new Setting(containerEl)
      .setName('Regenerate token')
      .setDesc('Invalidates the old token immediately')
      .addButton((b) =>
        b.setButtonText('Regenerate').onClick(async () => {
          await this.plugin.regenerateToken();
          this.display();
        })
      );

    new Setting(containerEl).setName('Status').setDesc(
      `${this.plugin.server ? `Server running on 127.0.0.1:${this.plugin.settings.port}` : 'Server off'} · ${
        this.plugin.store ? this.plugin.store.count() : 0
      } records · audit chain: ${
        this.plugin.store ? (this.plugin.store.verifyChain().ok ? 'verified' : 'BROKEN') : 'n/a'
      }`
    );
  }
}