/**
 * Component for tracking and displaying analysis progress
 */
export class ProgressTracker {
  constructor() {
    this.progressEl = document.getElementById("progress");
    this.progressLog = document.getElementById("progress-log");
    this.progressHeader = document.getElementById("progress-log-header");
    this.messageHandlers = {
      init: (msg) => this.showInit(msg),
      "journeys-fetched": (msg) => this.showJourneysFetched(msg),
      "route-parsed": (msg) => this.showRouteParsed(msg),
      "segments-start": (msg) => this.showSegmentsStart(msg),
      "segment-pricing": (msg) => this.showSegmentPricing(msg),
      "segment-priced": (msg) => this.showSegmentPriced(msg),
      "segment-retry": (msg) => this.showSegmentRetry(msg),
      "segments-progress": (msg) => this.showSegmentsProgress(msg),
      "segments-done": (msg) => this.showSegmentsDone(msg),
      "dp-start": (msg) => this.showDpStart(msg),
      "dp-done": (msg) => this.showDpDone(msg),
    };
  }

  /**
   * Initialize progress tracker
   */
  init() {
    browser.runtime.onMessage.addListener(this.handleProgress.bind(this));
    this.setupCollapsible();
  }

  /**
   * Setup collapsible log header
   */
  setupCollapsible() {
    if (!this.progressHeader) return;

    this.progressHeader.addEventListener("click", () => {
      const isCollapsed = this.progressHeader.classList.contains("collapsed");
      this.progressHeader.classList.toggle("collapsed");
      if (this.progressLog) {
        this.progressLog.style.display = isCollapsed ? "block" : "none";
      }
    });
  }

  /**
   * Handle progress message
   * @param {Object} msg - Progress message
   */
  handleProgress(msg) {
    if (msg?.type !== "analysis-progress") return;

    const handler = this.messageHandlers[msg.phase];
    if (handler) {
      handler(msg);
    }

    this.log(this.formatLogMessage(msg));
  }

  /**
   * Show/hide progress UI
   */
  show() {
    if (this.progressLog) {
      this.progressLog.textContent = "";
      this.progressLog.style.display = "block";
    }
    if (this.progressHeader) {
      this.progressHeader.classList.remove("collapsed");
    }
  }

  /**
   * Update progress text
   * @param {string} text - Progress text
   */
  updateText(text) {
    if (this.progressEl) {
      this.progressEl.textContent = text;
    }
  }

  /**
   * Log message to progress log
   * @param {string} line - Log line
   */
  log(line) {
    if (!this.progressLog) return;
    const div = document.createElement("div");
    div.textContent = line;
    this.progressLog.appendChild(div);
    this.progressLog.scrollTop = this.progressLog.scrollHeight;
  }

  // Progress phase handlers

  showInit(msg) {
    this.updateText("Initialisiere Analyse...");
  }

  showJourneysFetched(msg) {
    this.updateText(
      `${msg.journeysCount} Verbindungen gefunden, analysiere Route...`,
    );
  }

  showRouteParsed(msg) {
    this.updateText(
      `Route analysiert (${msg.nodes} Halte), preise Segmente...`,
    );
  }

  showSegmentsStart(msg) {
    this.updateText(`Preise ${msg.total} Segmente...`);
  }

  showSegmentPricing(msg) {
    // Log only, no UI update
  }

  showSegmentPriced(msg) {
    // Log only, no UI update
  }

  showSegmentRetry(msg) {
    // Log only, no UI update
  }

  showSegmentsProgress(msg) {
    const percent = Math.round((msg.done / msg.total) * 100);
    this.updateText(`Segmentpreise: ${msg.done}/${msg.total} (${percent}%)`);
  }

  showSegmentsDone(msg) {
    this.updateText("Berechne beste Aufteilung...");
  }

  showDpStart(msg) {
    this.updateText(
      `Optimiere aus ${msg.validSegments} verfügbaren Segmenten...`,
    );
  }

  showDpDone(msg) {
    if (msg.error) {
      this.updateText("Optimierung fehlgeschlagen");
    } else {
      this.updateText(
        `Analyse abgeschlossen: ${msg.segmentsUsed} Segmente, ${msg.totalCost.toFixed(2)} EUR`,
      );
    }
  }

  /**
   * Format log message
   * @param {Object} msg - Progress message
   * @returns {string} Formatted message
   */
  formatLogMessage(msg) {
    switch (msg.phase) {
      case "init":
        return `Init: EVA ${msg.fromEva} → ${msg.toEva} @ ${msg.depDateTime}`;
      case "journeys-fetched":
        return `Found ${msg.journeysCount} journeys`;
      case "route-parsed":
        return `Route parsed: ${msg.nodes} Halte`;
      case "segments-start":
        return `Pricing ${msg.total} segments (nodes ${msg.totalNodes})…`;
      case "segment-pricing":
        return `Pricing ${msg.fromIdx}→${msg.toIdx} (${msg.fromEva}→${msg.toEva})…`;
      case "segment-priced":
        return (
          `${msg.fromIdx}→${msg.toIdx} ${msg.ok ? "ok" : "fail"}` +
          (msg.error ? ` (${msg.error})` : "") +
          (msg.attempts > 1 ? ` [${msg.attempts} attempts]` : "")
        );
      case "segment-retry":
        return `${msg.fromIdx}→${msg.toIdx} retry ${msg.attempt} in ${msg.nextAttemptIn}ms: ${msg.error}`;
      case "segments-progress":
        const percent = Math.round((msg.done / msg.total) * 100);
        return `Progress: ${msg.done}/${msg.total} segments (${percent}%)`;
      case "segments-done":
        return `Segments done: ${msg.produced}/${msg.total}`;
      case "dp-start":
        return `Computing best split from ${msg.validSegments} valid segments…`;
      case "dp-done":
        if (msg.error) {
          return `DP optimization failed: ${msg.error}`;
        }
        return `Best split found: ${msg.segmentsUsed} segments, total ${msg.totalCost.toFixed(2)} EUR`;
      default:
        return JSON.stringify(msg);
    }
  }
}
