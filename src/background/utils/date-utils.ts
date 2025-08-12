import { formatBerlinDateTime, parseHd } from '../adapters/dbnav';

export class DateUtils {
  static parseDateTime(selection: any): string {
    let hd = selection?.dateTimeParam as string | null | undefined;
    if (!hd && selection?.pageUrl) {
      hd = parseHd(selection.pageUrl) || null;
    }

    const [hh, mm] = String(selection?.depTime || '')
      .split(':')
      .map((x) => parseInt(x, 10));

    let y: number, m: number, d: number;
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

    return formatBerlinDateTime(y, m, d, isNaN(hh) ? 8 : hh, isNaN(mm) ? 0 : mm, 0);
  }
}

