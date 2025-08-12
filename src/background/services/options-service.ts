import browser from 'webextension-polyfill';

export class OptionsService {
  private DEFAULT_OPTIONS = { class: '2', age: 30, bahncard: 'none', dticket: false } as const;

  async getOptions() {
    const { options } = await browser.storage.local.get('options');
    return { options: { ...this.DEFAULT_OPTIONS, ...(options || {}) } };
  }

  async setOptions(options: any) {
    const next = { ...this.DEFAULT_OPTIONS, ...options };
    await browser.storage.local.set({ options: next });
    return { ok: true };
  }
}

