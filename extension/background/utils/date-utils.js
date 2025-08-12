/**
 * Utility functions for date and time handling
 */
export class DateUtils {
  /**
   * Parse date/time from selection data
   * @param {Object} selection - Selection object with date/time info
   * @returns {string} ISO datetime string
   */
  static parseDateTime(selection) {
    let hd = selection.dateTimeParam;
    if (!hd && selection.pageUrl) {
      hd = self.DBNavLite?.parseHd(selection.pageUrl) || null;
    }

    const [hh, mm] = (selection.depTime || "")
      .split(":")
      .map((x) => parseInt(x, 10));

    let y, m, d;
    if (hd) {
      const dt = new Date(hd);
      y = dt.getFullYear();
      m = dt.getMonth() + 1;
      d = dt.getDate();
    } else {
      const now = new Date();
      y = now.getFullYear();
      m = now.getMonth() + 1;
      d = now.getDate();
    }

    return self.DBNavLite.formatBerlinDateTime(
      y,
      m,
      d,
      isNaN(hh) ? 8 : hh,
      isNaN(mm) ? 0 : mm,
      0,
    );
  }
}
