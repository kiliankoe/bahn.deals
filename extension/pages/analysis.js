import { MapManager } from "./components/map-manager.js";
import { OptionsForm } from "./components/options-form.js";
import { ProgressTracker } from "./components/progress-tracker.js";
import { ResultsRenderer } from "./components/results-renderer.js";
import { RouteInfo } from "./components/route-info.js";

/**
 * Main controller for analysis page
 */
class AnalysisController {
  constructor() {
    this.token = new URLSearchParams(location.search).get("token");
    this.mapManager = new MapManager();
    this.progressTracker = new ProgressTracker();
    this.resultsRenderer = new ResultsRenderer();
    this.optionsForm = new OptionsForm();
    this.routeInfo = new RouteInfo();

    this.EXT =
      (typeof browser !== "undefined" && browser) ||
      (typeof chrome !== "undefined" && chrome);

    this.elements = {
      routeEl: document.getElementById("route"),
      metaEl: document.getElementById("meta"),
      progressEl: document.getElementById("progress"),
      detailsEl: document.getElementById("details"),
      runBtn: document.getElementById("run"),
      mapContainer: document.getElementById("map-container"),
      result: document.getElementById("result"),
    };
  }

  /**
   * Initialize the controller
   */
  async init() {
    const selection = await this.loadSelection();
    if (!selection) {
      this.showNoSelectionError();
      return;
    }

    this.displaySelection(selection);
    await this.optionsForm.init();
    this.setupAnalysisButton();
    this.progressTracker.init();

    // Fetch and display initial route
    const route = await this.fetchInitialRoute();
    if (route) {
      this.showMapContainer();
      this.mapManager.displayRoute(route.nodes);
      this.routeInfo.display(route.nodes);
    }
  }

  /**
   * Load selection from session
   * @returns {Object|null} Selection data
   */
  async loadSelection() {
    if (!this.token) return null;

    try {
      const res = await this.EXT.runtime.sendMessage({
        type: (self.BD_MSG && BD_MSG.GET_ANALYSIS_SELECTION) || "get-analysis-selection",
        token: this.token,
      });
      return res?.selection || null;
    } catch (e) {
      console.error("Failed to load selection:", e);
      return null;
    }
  }

  /**
   * Display selection info
   * @param {Object} selection - Selection data
   */
  displaySelection(selection) {
    const { fromName, toName, depTime, arrTime, dateTimeParam, lines } =
      selection;

    if (this.elements.routeEl) {
      this.elements.routeEl.textContent = `${fromName || "Start"} → ${toName || "Ziel"}`;
    }

    if (this.elements.metaEl) {
      this.elements.metaEl.textContent = `${depTime || "?"} – ${arrTime || "?"}  |  ${dateTimeParam || ""}`;
    }

    if (this.elements.progressEl) {
      this.elements.progressEl.textContent =
        "Lade Streckendaten für Kartenanzeige...";
    }

    if (this.elements.detailsEl) {
      this.elements.detailsEl.textContent = `Verkehrsmittel: ${Array.isArray(lines) && lines.length ? lines.join(", ") : "unbekannt"}`;
    }
  }

  /**
   * Show no selection error
   */
  showNoSelectionError() {
    if (this.elements.routeEl) {
      this.elements.routeEl.textContent = "bahn.deals – Analyse";
    }

    if (this.elements.metaEl) {
      this.elements.metaEl.textContent = "";
    }

    if (this.elements.progressEl) {
      this.elements.progressEl.textContent =
        "Keine übergebene Verbindung gefunden.";
    }

    if (this.elements.detailsEl) {
      this.elements.detailsEl.textContent =
        'Öffnen Sie das Menü einer Verbindung auf bahn.de und wählen Sie „Günstigste Aufteilung suchen".';
    }
  }

  /**
   * Fetch initial route data
   * @returns {Object|null} Route data
   */
  async fetchInitialRoute() {
    if (!this.token) return null;

    try {
      const res = await this.EXT.runtime.sendMessage({
        type: (self.BD_MSG && BD_MSG.FETCH_ROUTE_ONLY) || "fetch-route-only",
        token: this.token,
      });

      if (res?.ok && res.route?.nodes && res.route.nodes.length > 1) {
        if (this.elements.progressEl) {
          this.elements.progressEl.textContent =
            "Verbindungsdaten geladen. Bereit für Analyse.";
        }
        return res.route;
      } else {
        if (this.elements.progressEl) {
          this.elements.progressEl.textContent =
            "Verbindungsdaten erhalten. Analyse in Vorbereitung …";
        }
        console.debug("Could not fetch initial route:", res?.error);
        return null;
      }
    } catch (e) {
      if (this.elements.progressEl) {
        this.elements.progressEl.textContent =
          "Verbindungsdaten erhalten. Analyse in Vorbereitung …";
      }
      console.debug("Error fetching initial route:", e);
      return null;
    }
  }

  /**
   * Show map container
   */
  showMapContainer() {
    if (this.elements.mapContainer) {
      this.elements.mapContainer.style.display = "";
    }
  }

  /**
   * Setup analysis button
   */
  setupAnalysisButton() {
    if (!this.elements.runBtn) return;

    this.elements.runBtn.addEventListener("click", () => this.runAnalysis());
  }

  /**
   * Run analysis
   */
  async runAnalysis() {
    if (!this.EXT?.runtime?.sendMessage) {
      if (this.elements.result) {
        this.elements.result.textContent = "API nicht verfügbar.";
      }
      return;
    }

    this.elements.runBtn.disabled = true;
    this.elements.runBtn.textContent = "Analysiere...";

    if (this.elements.progressEl) {
      this.elements.progressEl.textContent = "Starte Analyse...";
    }

    this.progressTracker.show();
    this.resultsRenderer.hide();

    const options = this.optionsForm.getValues();

    try {
      const res = await this.EXT.runtime.sendMessage({
        type: (self.BD_MSG && BD_MSG.START_ANALYSIS) || "start-analysis",
        token: this.token,
        options,
      });

      if (!res?.ok) {
        this.showError(res?.error);
      } else {
        // Map is already shown from initial route fetch
        // Progress tracker handles route parsing messages
        this.resultsRenderer.display(res.summary);
      }
    } catch (e) {
      this.showError(e?.message);
    } finally {
      this.elements.runBtn.disabled = false;
      this.elements.runBtn.textContent = "Analyse starten";
    }
  }

  /**
   * Show error message
   * @param {string} error - Error message
   */
  showError(error) {
    const errorMsg = error
      ? `Fehler beim Starten der Analyse.\n${error}`
      : "Unerwarteter Fehler.";

    if (document.getElementById("result")) {
      document.getElementById("result").textContent = errorMsg;
    }
  }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  new AnalysisController().init();
});
