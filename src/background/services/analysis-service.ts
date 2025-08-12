import browser from 'webextension-polyfill';
import { DateUtils } from '../utils/date-utils';
import { PricingService } from './pricing-service';
import { OptimizerService } from './optimizer-service';
import { dbnavJourneys, dbnavRefreshTickets } from '../adapters/dbnav';

export class AnalysisService {
  constructor(private routeService: any, private optionsService: any) {}

  private pricingService = new PricingService();
  private optimizerService = new OptimizerService();

  async startAnalysis(token: string, userOptions: any, sessionService: any) {
    const progress = this.createProgressReporter(token, sessionService);
    try {
      const entry = sessionService.getSession(token);
      if (!entry.selection) return { ok: false, error: 'no-session' } as const;
      const options = userOptions || (await this.optionsService.getOptions()).options;
      const selection = entry.selection;
      const depDateTime = DateUtils.parseDateTime(selection);
      const { fromEva, toEva } = await this.routeService.resolveStations(selection);
      if (!fromEva || !toEva) return { ok: false, error: 'resolve-failed', selection } as const;
      await progress({ phase: 'init', fromEva, toEva, depDateTime });

      const j = await dbnavJourneys({ fromEva, toEva, depDateTime, opts: options });
      const journeys = Array.isArray(j?.verbindungen) ? j.verbindungen : [];
      await progress({ phase: 'journeys-fetched', journeysCount: journeys.length });
      const first = journeys[0]?.verbindung || null;
      if (!first?.kontext) return { ok: false, error: 'no-journey-found' } as const;

      const ticketsInfo = await this.fetchTicketsInfo(first, options);
      const route = await this.fetchRoute(first, options, progress);
      const segments = await this.pricingService.priceSegments(route, options, progress);
      const split = await this.optimizerService.findOptimalSplit(segments, route.nodes.length, progress);
      return { ok: true, summary: { note: 'dbnav integrated: journeys fetched', depDateTime, userOptions: options, selection, fromEva, toEva, journeysCount: journeys.length, firstContext: first.kontext, ticketsInfo, route, segments, split } } as const;
    } catch (err: any) {
      return { ok: false, error: String(err?.message || err) } as const;
    }
  }

  private createProgressReporter(token: string, sessionService: any) {
    return async (payload: any) => {
      // Prefer port streaming if available
      const port = sessionService.getPort(token);
      if (port) {
        try {
          port.postMessage({ type: 'analysis-progress', ...payload });
          return;
        } catch {}
      }
      try {
        await browser.runtime.sendMessage({ type: 'analysis-progress', ...payload });
      } catch {}
    };
  }

  private async fetchTicketsInfo(journey: any, options: any) {
    try {
      const recon = await dbnavRefreshTickets({ refreshToken: journey.kontext, opts: options });
      const offers: any[] = [];
      this.walkOffers(recon?.angebote || {}, offers);
      const best = offers.length ? offers.reduce((a, b) => (a.amount <= b.amount ? a : b)) : null;
      return { hasAngebote: !!recon?.angebote, angebotseinholungNachgelagert: recon?.angebote?.angebotseinholungNachgelagert ?? null, angebotsMeldungen: recon?.angebote?.angebotsMeldungen ?? null, offers: offers.slice(0, 10), bestOffer: best };
    } catch (e: any) {
      return { error: String(e?.message || e) };
    }
  }

  private async fetchRoute(journey: any, options: any, progress: (p: any) => Promise<void>) {
    const recon = await dbnavRefreshTickets({ refreshToken: journey.kontext, opts: options });
    const route = await this.routeService.parseRoute(recon);
    await progress({ phase: 'route-parsed', nodes: route.nodes.length, route });
    return route;
  }

  private walkOffers(obj: any, offers: any[]) {
    if (!obj) return;
    const clusters = obj.angebotsCluster || [];
    for (const cl of clusters) {
      const subs = cl.angebotsSubCluster || [];
      for (const sub of subs) {
        const pos = sub.angebotsPositionen || [];
        for (const p of pos) {
          const ef = p.einfacheFahrt?.standard?.reisePosition?.reisePosition;
          const preis = ef?.preis;
          if (preis && typeof preis.betrag === 'number') {
            offers.push({ name: ef?.name || 'Angebot', amount: preis.betrag, currency: preis.waehrung || 'EUR', klass: ef?.lupKategorien?.klasse || null, art: ef?.lupKategorien?.angebotsArt || null });
          }
        }
      }
    }
  }
}
