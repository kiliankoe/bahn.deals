/**
 * Service for managing analysis sessions
 */
export class SessionService {
  constructor() {
    this.sessionStore = new Map();
  }

  /**
   * Create a new analysis session
   * @param {Object} selection - Selected journey data
   * @returns {Object} Result with token
   */
  async createSession(selection) {
    const token = this.generateToken();
    this.sessionStore.set(token, {
      selection,
      createdAt: Date.now(),
    });

    const url = browser.runtime.getURL(
      `pages/analysis.html?token=${encodeURIComponent(token)}`,
    );
    await browser.tabs.create({ url });

    return { ok: true, token };
  }

  /**
   * Get session data by token
   * @param {string} token - Session token
   * @returns {Object} Session data
   */
  getSession(token) {
    const entry = this.sessionStore.get(token);
    return { selection: entry?.selection || null };
  }

  /**
   * Clean up session
   * @param {string} token - Session token
   * @returns {Object} Success result
   */
  cleanupSession(token) {
    this.sessionStore.delete(token);
    return { ok: true };
  }

  /**
   * Generate unique session token
   * @returns {string} Token
   */
  generateToken() {
    return `bd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
