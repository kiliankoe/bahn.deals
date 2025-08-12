/**
 * Utility functions for formatting
 */
export class FormatUtils {
  /**
   * Format duration in minutes to human readable
   * @param {number} minutes - Duration in minutes
   * @returns {string} Formatted duration
   */
  static formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  }

  /**
   * Format time from ISO string
   * @param {string} isoString - ISO datetime string
   * @returns {string} Formatted time
   */
  static formatTime(isoString) {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Format price
   * @param {number} amount - Price amount
   * @param {string} currency - Currency code
   * @returns {string} Formatted price
   */
  static formatPrice(amount, currency = "EUR") {
    return `${amount.toFixed(2)} ${currency}`;
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {boolean} Success status
   */
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Failed to copy:", err);
      return false;
    }
  }
}
