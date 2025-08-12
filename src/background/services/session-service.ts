/** Session management (storage-backed in MV3 later). */
import browser from 'webextension-polyfill';

export class SessionService {
  private sessionStore = new Map<string, any>();
  private portsByToken = new Map<string, browser.Runtime.Port>();
  private tokenByPort = new Map<number, string>();

  private async loadFromStorageIfEmpty() {
    if (this.sessionStore.size > 0) return;
    try {
      const { sessions } = await browser.storage.local.get('sessions');
      if (sessions && typeof sessions === 'object') {
        for (const [token, value] of Object.entries(sessions as Record<string, any>)) {
          this.sessionStore.set(token, value);
        }
      }
    } catch {}
  }

  async createSession(selection: any) {
    const token = this.generateToken();
    this.sessionStore.set(token, { selection, createdAt: Date.now() });
    try {
      const { sessions } = await browser.storage.local.get('sessions');
      const next = { ...(sessions || {}), [token]: { selection, createdAt: Date.now() } };
      await browser.storage.local.set({ sessions: next });
    } catch {}

    // Open analysis page like MV2 behavior
    const url = browser.runtime.getURL(`src/pages/analysis.html?token=${encodeURIComponent(token)}`);
    try {
      await browser.tabs.create({ url });
    } catch {}

    return { ok: true, token };
  }

  getSession(token: string) {
    const entry = this.sessionStore.get(token);
    return { selection: entry?.selection || null };
  }

  cleanupSession(token: string) {
    this.sessionStore.delete(token);
    try {
      browser.storage.local.get('sessions').then(({ sessions }) => {
        const next = { ...(sessions || {}) };
        delete (next as any)[token];
        browser.storage.local.set({ sessions: next });
      });
    } catch {}
    return { ok: true };
  }

  private generateToken() {
    return `bd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // Port management for streaming progress
  async registerPort(token: string, port: browser.Runtime.Port) {
    await this.loadFromStorageIfEmpty();
    this.portsByToken.set(token, port);
    this.tokenByPort.set((port as any).sender?.tab?.id ?? Math.random(), token);
  }

  getPort(token: string): browser.Runtime.Port | undefined {
    return this.portsByToken.get(token);
  }

  unregisterPort(port: browser.Runtime.Port) {
    // Remove any token mapping for this port
    for (const [tk, p] of this.portsByToken.entries()) {
      if (p === port) this.portsByToken.delete(tk);
    }
  }
}
