/**
 * Service for pricing route segments
 */
export class PricingService {
  constructor() {
    this.concurrency = 2;
    this.throttleMs = 500;
    this.maxRetries = 3;
  }

  /**
   * Price all segments of a route
   * @param {Object} route - Route with nodes
   * @param {Object} options - User options
   * @param {Function} progressCallback - Progress callback
   * @returns {Array} Array of priced segments
   */
  async priceSegments(route, options, progressCallback) {
    const segments = [];
    const tasks = this.generateTasks(route);
    let done = 0;
    const total = tasks.length;

    await progressCallback({
      phase: "segments-start",
      totalNodes: route.nodes.length,
      total,
    });

    await this.runConcurrent(tasks, async ([i, j]) => {
      const segment = await this.priceSegment(
        i,
        j,
        route,
        options,
        progressCallback,
      );
      if (segment) segments.push(segment);

      done++;
      if (done % Math.max(1, Math.floor(total / 20)) === 0 || done === total) {
        await progressCallback({ phase: "segments-progress", done, total });
      }
    });

    await progressCallback({
      phase: "segments-done",
      produced: segments.length,
      total,
    });

    return segments;
  }

  /**
   * Generate all segment tasks
   * @param {Object} route - Route data
   * @returns {Array} Array of [fromIdx, toIdx] pairs
   */
  generateTasks(route) {
    const tasks = [];
    const n = route?.nodes?.length || 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        tasks.push([i, j]);
      }
    }

    return tasks;
  }

  /**
   * Run tasks concurrently with throttling
   * @param {Array} tasks - Array of tasks
   * @param {Function} handler - Task handler function
   */
  async runConcurrent(tasks, handler) {
    const runNext = async () => {
      while (tasks.length > 0) {
        const task = tasks.shift();
        if (!task) break;

        try {
          await handler(task);
        } catch (e) {
          console.warn(`Task failed:`, e);
        }

        if (tasks.length > 0) {
          await new Promise((res) => setTimeout(res, this.throttleMs));
        }
      }
    };

    await Promise.all(Array.from({ length: this.concurrency }, runNext));
  }

  /**
   * Price a single segment
   * @param {number} fromIdx - From node index
   * @param {number} toIdx - To node index
   * @param {Object} route - Route data
   * @param {Object} options - User options
   * @param {Function} progressCallback - Progress callback
   * @returns {Object} Priced segment or error
   */
  async priceSegment(fromIdx, toIdx, route, options, progressCallback) {
    return this.withRetry(async (attempt) => {
      try {
        const fromNode = route?.nodes?.[fromIdx];
        const toNode = route?.nodes?.[toIdx];
        if (!fromNode || !toNode || !fromNode.dep) return null;

        await progressCallback({
          phase: "segment-pricing",
          fromIdx,
          toIdx,
          fromEva: fromNode.eva,
          toEva: toNode.eva,
          attempt,
        });

        const journeys = await this.fetchJourneys(fromNode, toNode, options);
        const matchingJourney = this.findMatchingJourney(
          journeys,
          fromIdx,
          toIdx,
          route,
        );

        if (!matchingJourney) {
          return { fromIdx, toIdx, error: "route-mismatch" };
        }

        const offers = await this.fetchOffers(matchingJourney, options);
        const bestOffer = this.findBestOffer(offers);

        await progressCallback({
          phase: "segment-priced",
          fromIdx,
          toIdx,
          ok: !!bestOffer,
          attempts: attempt,
        });

        return {
          fromIdx,
          toIdx,
          from: { eva: fromNode.eva, name: fromNode.name },
          to: { eva: toNode.eva, name: toNode.name },
          bestOffer,
          offersCount: offers.length,
          attempts: attempt,
        };
      } catch (e) {
        const isRetryable = this.isRetryableError(e);

        if (attempt < this.maxRetries && isRetryable) {
          const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 10000);
          await progressCallback({
            phase: "segment-retry",
            fromIdx,
            toIdx,
            attempt,
            nextAttemptIn: backoffMs,
            error: String(e?.message || e),
          });
          await new Promise((res) => setTimeout(res, backoffMs));
          throw e; // Re-throw to trigger retry
        }

        await progressCallback({
          phase: "segment-priced",
          fromIdx,
          toIdx,
          ok: false,
          error: String(e?.message || e),
          attempts: attempt,
        });

        return {
          fromIdx,
          toIdx,
          error: String(e?.message || e),
          attempts: attempt,
        };
      }
    });
  }

  /**
   * Fetch journeys for segment
   * @param {Object} fromNode - From node
   * @param {Object} toNode - To node
   * @param {Object} options - User options
   * @returns {Array} Journeys
   */
  async fetchJourneys(fromNode, toNode, options) {
    const j2 = await self.DBNavLite.dbnavJourneys({
      fromEva: fromNode.eva,
      toEva: toNode.eva,
      depDateTime: fromNode.dep,
      opts: options,
    });

    return Array.isArray(j2?.verbindungen) ? j2.verbindungen : [];
  }

  /**
   * Find journey matching the route
   * @param {Array} journeys - Candidate journeys
   * @param {number} fromIdx - From index
   * @param {number} toIdx - To index
   * @param {Object} route - Original route
   * @returns {Object|null} Matching journey
   */
  findMatchingJourney(journeys, fromIdx, toIdx, route) {
    const expectedSeq = this.expectedTrainSeqBetween(fromIdx, toIdx, route);

    for (let ci = 0; ci < Math.min(3, journeys.length); ci++) {
      const vb = journeys[ci]?.verbindung;
      if (!vb) continue;

      const seq = this.extractTrainSequence(vb);
      const equal =
        seq.length === expectedSeq.length &&
        seq.every((v, idx) => v === expectedSeq[idx]);

      if (equal && vb.kontext) {
        return vb;
      }
    }

    return null;
  }

  /**
   * Extract train sequence from journey
   * @param {Object} journey - Journey data
   * @returns {Array} Train labels
   */
  extractTrainSequence(journey) {
    const seq = [];
    const secs = journey?.verbindungsAbschnitte || [];

    for (const s of secs) {
      if (s?.typ !== "FAHRZEUG") continue;
      const lab = (
        s.mitteltext ||
        s.langtext ||
        s.kurztext ||
        s.risZuglaufId ||
        s.zuglaufId ||
        ""
      ).trim();
      if (!seq.length || seq[seq.length - 1] !== lab) seq.push(lab);
    }

    return seq;
  }

  /**
   * Get expected train sequence between nodes
   * @param {number} i - From index
   * @param {number} j - To index
   * @param {Object} route - Route data
   * @returns {Array} Expected train labels
   */
  expectedTrainSeqBetween(i, j, route) {
    const seq = [];
    if (!route?.nodes) return seq;

    for (let k = i; k <= j; k++) {
      const lbl = route.nodes[k]?.trainLabel || null;
      if (!lbl) continue;
      if (!seq.length || seq[seq.length - 1] !== lbl) seq.push(lbl);
    }

    return seq;
  }

  /**
   * Fetch ticket offers for journey
   * @param {Object} journey - Journey with refresh token
   * @param {Object} options - User options
   * @returns {Array} Offers
   */
  async fetchOffers(journey, options) {
    const recon = await self.DBNavLite.dbnavRefreshTickets({
      refreshToken: journey.kontext,
      opts: options,
    });

    const offers = [];
    this.walkOffers(recon?.angebote || {}, offers);
    return offers;
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
            });
          }
        }
      }
    }
  }

  /**
   * Find best (cheapest) offer
   * @param {Array} offers - Array of offers
   * @returns {Object|null} Best offer
   */
  findBestOffer(offers) {
    return offers.length
      ? offers.reduce((a, b) => (a.amount <= b.amount ? a : b))
      : null;
  }

  /**
   * Check if error is retryable
   * @param {Error} e - Error object
   * @returns {boolean} True if retryable
   */
  isRetryableError(e) {
    return (
      e?.message?.includes?.("rate limit") ||
      e?.message?.includes?.("timeout") ||
      e?.message?.includes?.("network") ||
      e?.status >= 500
    );
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Function to execute
   * @returns {*} Function result
   */
  async withRetry(fn) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (e) {
        lastError = e;
        if (attempt === this.maxRetries || !this.isRetryableError(e)) {
          break;
        }
      }
    }

    throw lastError;
  }
}
