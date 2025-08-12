import { DateUtils } from "../utils/date-utils.js";
import { PricingService } from "./pricing-service.js";
import { OptimizerService } from "./optimizer-service.js";

/**
 * Service for running full journey analysis
 */
export class AnalysisService {
  constructor(routeService, optionsService) {
    this.routeService = routeService;
    this.optionsService = optionsService;
    this.pricingService = new PricingService();
    this.optimizerService = new OptimizerService();
  }

  /**
   * Start full analysis
   * @param {string} token - Session token
   * @param {Object} userOptions - User-provided options (optional)
   * @param {SessionService} sessionService - Session service
   * @returns {Object} Analysis result
   */
  async startAnalysis(token, userOptions, sessionService) {
    const progress = this.createProgressReporter();

    try {
      // Get session and options
      const entry = sessionService.getSession(token);
      if (!entry.selection) return { ok: false, error: "no-session" };

      const options =
        userOptions || (await this.optionsService.getOptions()).options;
      const selection = entry.selection;

      // Parse date/time and resolve stations
      const depDateTime = DateUtils.parseDateTime(selection);
      const { fromEva, toEva } = await this.routeService.resolveStations(selection);

      if (!fromEva || !toEva) {
        return { ok: false, error: "resolve-failed", selection };
      }

      console.debug("[analysis] computed", { fromEva, toEva, depDateTime });
      await progress({ phase: "init", fromEva, toEva, depDateTime });

      // Fetch journeys
      const journeys = await this.fetchJourneys(
        fromEva,
        toEva,
        depDateTime,
        options,
      );
      await progress({
        phase: "journeys-fetched",
        journeysCount: journeys.length,
      });

      const first = journeys[0]?.verbindung || null;
      if (!first?.kontext) {
        return { ok: false, error: "no-journey-found" };
      }

      // Get tickets and route
      const ticketsInfo = await this.fetchTicketsInfo(first, options);
      const route = await this.fetchRoute(first, options, progress);

      // Price segments
      const segments = await this.pricingService.priceSegments(
        route,
        options,
        progress,
      );

      // Find optimal split
      const split = await this.optimizerService.findOptimalSplit(
        segments,
        route.nodes.length,
        progress,
      );

      return {
        ok: true,
        summary: {
          note: "dbnav integrated: journeys fetched",
          depDateTime,
          userOptions: options,
          selection,
          fromEva,
          toEva,
          journeysCount: journeys.length,
          firstContext: first.kontext,
          ticketsInfo,
          route,
          segments,
          split,
        },
      };
    } catch (err) {
      console.error("[analysis] error", err);
      return { ok: false, error: String(err?.message || err) };
    }
  }

  /**
   * Create progress reporter function
   * @returns {Function} Progress reporter
   */
  createProgressReporter() {
    return async (payload) => {
      try {
        await browser.runtime.sendMessage({
          type: (self.BD_MSG && self.BD_MSG.ANALYSIS_PROGRESS) || "analysis-progress",
          ...payload,
        });
      } catch {
        // Ignore send errors
      }
    };
  }

  

  /**
   * Fetch journeys
   * @param {string} fromEva - From EVA
   * @param {string} toEva - To EVA
   * @param {string} depDateTime - Departure datetime
   * @param {Object} options - User options
   * @returns {Array} Journeys
   */
  async fetchJourneys(fromEva, toEva, depDateTime, options) {
    const j = await self.DBNavLite.dbnavJourneys({
      fromEva,
      toEva,
      depDateTime,
      opts: options,
    });

    return Array.isArray(j?.verbindungen) ? j.verbindungen : [];
  }

  /**
   * Fetch tickets info for journey
   * @param {Object} journey - Journey with kontext
   * @param {Object} options - User options
   * @returns {Object} Tickets info
   */
  async fetchTicketsInfo(journey, options) {
    try {
      const recon = await self.DBNavLite.dbnavRefreshTickets({
        refreshToken: journey.kontext,
        opts: options,
      });

      const offers = [];
      this.walkOffers(recon?.angebote || {}, offers);

      const best = offers.length
        ? offers.reduce((a, b) => (a.amount <= b.amount ? a : b))
        : null;

      return {
        hasAngebote: !!recon?.angebote,
        angebotseinholungNachgelagert:
          recon?.angebote?.angebotseinholungNachgelagert ?? null,
        angebotsMeldungen: recon?.angebote?.angebotsMeldungen ?? null,
        offers: offers.slice(0, 10),
        bestOffer: best,
      };
    } catch (e) {
      return { error: String(e?.message || e) };
    }
  }

  /**
   * Fetch and parse route
   * @param {Object} journey - Journey with kontext
   * @param {Object} options - User options
   * @param {Function} progress - Progress callback
   * @returns {Object} Route
   */
  async fetchRoute(journey, options, progress) {
    const recon = await self.DBNavLite.dbnavRefreshTickets({
      refreshToken: journey.kontext,
      opts: options,
    });

    const route = await this.routeService.parseRoute(recon);

    await progress({
      phase: "route-parsed",
      nodes: route.nodes.length,
      route,
    });

    return route;
  }

  /**
   * Walk offer tree and extract offers
   * @param {Object} obj - Offer object
   * @param {Array} offers - Output array
   */
  walkOffers(obj, offers) {
    if (!obj) return;

    const clusters = obj.angebotsCluster || [];
    for (const cl of clusters) {
      const subs = cl.angebotsSubCluster || [];
      for (const sub of subs) {
        const pos = sub.angebotsPositionen || [];
        for (const p of pos) {
          const ef = p.einfacheFahrt?.standard?.reisePosition?.reisePosition;
          const preis = ef?.preis;
          if (preis && typeof preis.betrag === "number") {
            offers.push({
              name: ef?.name || "Angebot",
              amount: preis.betrag,
              currency: preis.waehrung || "EUR",
              klass: ef?.lupKategorien?.klasse || null,
              art: ef?.lupKategorien?.angebotsArt || null,
            });
          }
        }
      }
    }
  }
}
