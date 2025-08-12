export class FormatUtils {
  static formatDuration(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  }
  static formatTime(isoString?: string | null) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  static formatPrice(amount: number, currency = 'EUR') {
    return `${amount.toFixed(2)} ${currency}`;
  }
  static async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

