import browser from 'webextension-polyfill';
import { MapManager } from './components/map-manager';
import { OptionsForm } from './components/options-form';
import { ProgressTracker } from './components/progress-tracker';
import { ResultsRenderer } from './components/results-renderer';
import { RouteInfo } from './components/route-info';
import { BD_MSG } from '../common/messages';
import './analysis.css';

class AnalysisController {
  private token = new URLSearchParams(location.search).get('token');
  private mapManager = new MapManager();
  private progressTracker = new ProgressTracker();
  private resultsRenderer = new ResultsRenderer();
  private optionsForm = new OptionsForm();
  private routeInfo = new RouteInfo();

  private elements = {
    routeEl: document.getElementById('route'),
    metaEl: document.getElementById('meta'),
    progressEl: document.getElementById('progress'),
    detailsEl: document.getElementById('details'),
    runBtn: document.getElementById('run') as HTMLButtonElement | null,
    mapContainer: document.getElementById('map-container') as HTMLElement | null,
    result: document.getElementById('result'),
  };

  async init() {
    // Establish a long-lived port for progress streaming
    if (this.token) {
      try {
        const port = browser.runtime.connect({ name: 'analysis' });
        port.postMessage({ type: 'register-port', token: this.token });
        port.onMessage.addListener((msg) => this.progressTracker.handleProgress(msg));
      } catch {}
    }
    const selection = await this.loadSelection();
    if (!selection) return this.showNoSelectionError();
    this.displaySelection(selection);
    await this.optionsForm.init();
    this.setupAnalysisButton();
    this.progressTracker.init();
    const route = await this.fetchInitialRoute();
    if (route) {
      this.showMapContainer();
      this.mapManager.displayRoute(route.nodes);
      this.routeInfo.display(route.nodes);
    }
  }

  private async loadSelection() {
    if (!this.token) return null;
    try {
      const res = await browser.runtime.sendMessage({ type: BD_MSG.GET_ANALYSIS_SELECTION, token: this.token });
      return res?.selection || null;
    } catch (e) {
      return null;
    }
  }

  private displaySelection(selection: any) {
    const { fromName, toName, depTime, arrTime, dateTimeParam, lines } = selection;
    if (this.elements.routeEl) this.elements.routeEl.textContent = `${fromName || 'Start'} → ${toName || 'Ziel'}`;
    if (this.elements.metaEl) this.elements.metaEl.textContent = `${depTime || '?'} – ${arrTime || '?'}  |  ${dateTimeParam || ''}`;
    if (this.elements.progressEl) this.elements.progressEl.textContent = 'Lade Streckendaten für Kartenanzeige...';
    if (this.elements.detailsEl) this.elements.detailsEl.textContent = `Verkehrsmittel: ${Array.isArray(lines) && lines.length ? lines.join(', ') : 'unbekannt'}`;
  }

  private showNoSelectionError() {
    if (this.elements.routeEl) this.elements.routeEl.textContent = 'bahn.deals – Analyse';
    if (this.elements.metaEl) this.elements.metaEl.textContent = '';
    if (this.elements.progressEl) this.elements.progressEl.textContent = 'Keine übergebene Verbindung gefunden.';
    if (this.elements.detailsEl) this.elements.detailsEl.textContent = 'Öffnen Sie das Menü einer Verbindung auf bahn.de und wählen Sie „Günstigste Aufteilung suchen".';
  }

  private async fetchInitialRoute() {
    if (!this.token) return null;
    try {
      const res = await browser.runtime.sendMessage({ type: BD_MSG.FETCH_ROUTE_ONLY, token: this.token });
      if (res?.ok && res.route?.nodes && res.route.nodes.length > 1) {
        if (this.elements.progressEl) this.elements.progressEl.textContent = 'Verbindungsdaten geladen. Bereit für Analyse.';
        return res.route;
      } else {
        if (this.elements.progressEl) this.elements.progressEl.textContent = 'Verbindungsdaten erhalten. Analyse in Vorbereitung …';
        return null;
      }
    } catch (e) {
      if (this.elements.progressEl) this.elements.progressEl.textContent = 'Verbindungsdaten erhalten. Analyse in Vorbereitung …';
      return null;
    }
  }

  private showMapContainer() {
    if (this.elements.mapContainer) this.elements.mapContainer.style.display = '';
  }

  private setupAnalysisButton() {
    if (!this.elements.runBtn) return;
    this.elements.runBtn.addEventListener('click', () => this.runAnalysis());
  }

  private async runAnalysis() {
    if (!this.elements.runBtn) return;
    this.elements.runBtn.disabled = true;
    this.elements.runBtn.textContent = 'Analysiere...';
    if (this.elements.progressEl) this.elements.progressEl.textContent = 'Starte Analyse...';
    this.progressTracker.show();
    this.resultsRenderer.hide();
    const options = this.optionsForm.getValues();
    try {
      const res = await browser.runtime.sendMessage({ type: BD_MSG.START_ANALYSIS, token: this.token, options });
      if (!res?.ok) this.showError(res?.error);
      else this.resultsRenderer.display(res.summary);
    } catch (e: any) {
      this.showError(e?.message);
    } finally {
      this.elements.runBtn.disabled = false;
      this.elements.runBtn.textContent = 'Analyse starten';
    }
  }

  private showError(error?: string) {
    const errorMsg = error ? `Fehler beim Starten der Analyse.\n${error}` : 'Unerwarteter Fehler.';
    if (this.elements.result) this.elements.result.textContent = errorMsg;
  }
}

document.addEventListener('DOMContentLoaded', () => new AnalysisController().init());
