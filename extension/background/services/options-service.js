/**
 * Service for managing user options/preferences
 */
export class OptionsService {
  constructor() {
    this.DEFAULT_OPTIONS = {
      class: "2",
      age: 30,
      bahncard: "none",
      dticket: false,
    };
  }

  /**
   * Get user options
   * @returns {Object} Options object
   */
  async getOptions() {
    const { options } = await browser.storage.local.get("options");
    return {
      options: { ...this.DEFAULT_OPTIONS, ...(options || {}) },
    };
  }

  /**
   * Set user options
   * @param {Object} options - New options
   * @returns {Object} Success result
   */
  async setOptions(options) {
    const next = { ...this.DEFAULT_OPTIONS, ...options };
    await browser.storage.local.set({ options: next });
    return { ok: true };
  }
}
