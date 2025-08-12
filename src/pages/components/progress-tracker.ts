import browser from 'webextension-polyfill';

export class ProgressTracker {
  private progressEl = document.getElementById('progress');
  private progressLog = document.getElementById('progress-log');
  private progressHeader = document.getElementById('progress-log-header');

  init() {
    browser.runtime.onMessage.addListener(this.handleProgress.bind(this));
    this.setupCollapsible();
  }

  private setupCollapsible() {
    if (!this.progressHeader) return;
    this.progressHeader.addEventListener('click', () => {
      const isCollapsed = this.progressHeader!.classList.contains('collapsed');
      this.progressHeader!.classList.toggle('collapsed');
      if (this.progressLog) this.progressLog.style.display = isCollapsed ? 'block' : 'none';
    });
  }

  handleProgress(msg: any) {
    if (msg?.type !== 'analysis-progress') return;
    const handler = this.messageHandlers[msg.phase as keyof typeof this.messageHandlers];
    if (handler) handler(msg);
    this.log(this.formatLogMessage(msg));
  }

  show() {
    if (this.progressLog) {
      this.progressLog.textContent = '';
      this.progressLog.style.display = 'block';
    }
    if (this.progressHeader) this.progressHeader.classList.remove('collapsed');
  }

  private updateText(text: string) {
    if (this.progressEl) this.progressEl.textContent = text;
  }

  private log(line: string) {
    if (!this.progressLog) return;
    const div = document.createElement('div');
    div.textContent = line;
    this.progressLog.appendChild(div);
    this.progressLog.scrollTop = this.progressLog.scrollHeight;
  }

  private messageHandlers = {
    init: (msg: any) => this.updateText('Initialisiere Analyse...'),
    'journeys-fetched': (msg: any) => this.updateText(`${msg.journeysCount} Verbindungen gefunden, analysiere Route...`),
    'route-parsed': (msg: any) => this.updateText(`Route analysiert (${msg.nodes} Halte), preise Segmente...`),
    'segments-start': (msg: any) => this.updateText(`Preise ${msg.total} Segmente...`),
    'segment-pricing': (msg: any) => {},
    'segment-priced': (msg: any) => {},
    'segment-retry': (msg: any) => {},
    'segments-progress': (msg: any) => {
      const percent = Math.round((msg.done / msg.total) * 100);
      this.updateText(`Segmentpreise: ${msg.done}/${msg.total} (${percent}%)`);
    },
    'segments-done': (msg: any) => this.updateText('Berechne beste Aufteilung...'),
    'dp-start': (msg: any) => this.updateText(`Optimiere aus ${msg.validSegments} verfügbaren Segmenten...`),
    'dp-done': (msg: any) => {
      if (msg.error) this.updateText('Optimierung fehlgeschlagen');
      else this.updateText(`Analyse abgeschlossen: ${msg.segmentsUsed} Segmente, ${msg.totalCost.toFixed(2)} EUR`);
    },
  } as const;

  private formatLogMessage(msg: any) {
    switch (msg.phase) {
      case 'init':
        return `Init: EVA ${msg.fromEva} → ${msg.toEva} @ ${msg.depDateTime}`;
      case 'journeys-fetched':
        return `Found ${msg.journeysCount} journeys`;
      case 'route-parsed':
        return `Route parsed: ${msg.nodes} Halte`;
      case 'segments-start':
        return `Pricing ${msg.total} segments (nodes ${msg.totalNodes})…`;
      case 'segment-pricing':
        return `Pricing ${msg.fromIdx}→${msg.toIdx} (${msg.fromEva}→${msg.toEva})…`;
      case 'segment-priced':
        return `${msg.fromIdx}→${msg.toIdx} ${msg.ok ? 'ok' : 'fail'}` + (msg.error ? ` (${msg.error})` : '') + (msg.attempts > 1 ? ` [${msg.attempts} attempts]` : '');
      case 'segment-retry':
        return `${msg.fromIdx}→${msg.toIdx} retry ${msg.attempt} in ${msg.nextAttemptIn}ms: ${msg.error}`;
      case 'segments-progress':
        return `Progress: ${msg.done}/${msg.total} segments (${Math.round((msg.done / msg.total) * 100)}%)`;
      case 'segments-done':
        return `Segments done: ${msg.produced}/${msg.total}`;
      case 'dp-start':
        return `Computing best split from ${msg.validSegments} valid segments…`;
      case 'dp-done':
        return msg.error ? `DP optimization failed: ${msg.error}` : `Best split found: ${msg.segmentsUsed} segments, total ${msg.totalCost.toFixed(2)} EUR`;
      default:
        return JSON.stringify(msg);
    }
  }
}
