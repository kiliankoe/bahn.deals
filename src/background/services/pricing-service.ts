import { dbnavJourneys, dbnavRefreshTickets } from '../adapters/dbnav';

export class PricingService {
  concurrency = 2;
  throttleMs = 500;
  maxRetries = 3;

  async priceSegments(route: any, options: any, progressCallback: (p: any) => Promise<void>) {
    const segments: any[] = [];
    const tasks = this.generateTasks(route);
    let done = 0;
    const total = tasks.length;
    await progressCallback({ phase: 'segments-start', totalNodes: route.nodes.length, total });
    await this.runConcurrent(tasks, async ([i, j]) => {
      const segment = await this.priceSegment(i, j, route, options, progressCallback);
      if (segment) segments.push(segment);
      done++;
      if (done % Math.max(1, Math.floor(total / 20)) === 0 || done === total) {
        await progressCallback({ phase: 'segments-progress', done, total });
      }
    });
    await progressCallback({ phase: 'segments-done', produced: segments.length, total });
    return segments;
  }

  generateTasks(route: any) {
    const tasks: [number, number][] = [];
    const n = route?.nodes?.length || 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) tasks.push([i, j]);
    }
    return tasks;
  }

  async runConcurrent(tasks: [number, number][], handler: (t: [number, number]) => Promise<void>) {
    const runNext = async () => {
      while (tasks.length) {
        const task = tasks.shift();
        if (!task) break;
        try {
          await handler(task);
        } catch {}
        if (tasks.length) await new Promise((res) => setTimeout(res, this.throttleMs));
      }
    };
    await Promise.all(Array.from({ length: this.concurrency }, runNext));
  }

  async priceSegment(fromIdx: number, toIdx: number, route: any, options: any, progressCallback: (p: any) => Promise<void>) {
    return this.withRetry(async (attempt) => {
      try {
        const fromNode = route?.nodes?.[fromIdx];
        const toNode = route?.nodes?.[toIdx];
        if (!fromNode || !toNode || !fromNode.dep) return null;
        await progressCallback({ phase: 'segment-pricing', fromIdx, toIdx, fromEva: fromNode.eva, toEva: toNode.eva, attempt });
        const journeys = await dbnavJourneys({ fromEva: fromNode.eva, toEva: toNode.eva, depDateTime: fromNode.dep, opts: options });
        const matchingJourney = this.findMatchingJourney(journeys, fromIdx, toIdx, route);
        if (!matchingJourney) return { fromIdx, toIdx, error: 'route-mismatch' };
        const offers = await this.fetchOffers(matchingJourney, options);
        const bestOffer = this.findBestOffer(offers);
        await progressCallback({ phase: 'segment-priced', fromIdx, toIdx, ok: !!bestOffer, attempts: attempt });
        return {
          fromIdx,
          toIdx,
          from: { eva: fromNode.eva, name: fromNode.name },
          to: { eva: toNode.eva, name: toNode.name },
          bestOffer,
          offersCount: offers.length,
          attempts: attempt,
        };
      } catch (e: any) {
        const isRetryable = this.isRetryableError(e);
        if (attempt < this.maxRetries && isRetryable) {
          const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 10000);
          await progressCallback({ phase: 'segment-retry', fromIdx, toIdx, attempt, nextAttemptIn: backoffMs, error: String(e?.message || e) });
          await new Promise((res) => setTimeout(res, backoffMs));
          throw e;
        }
        await progressCallback({ phase: 'segment-priced', fromIdx, toIdx, ok: false, error: String(e?.message || e), attempts: attempt });
        return { fromIdx, toIdx, error: String(e?.message || e), attempts: attempt };
      }
    });
  }

  findMatchingJourney(journeys: any[], fromIdx: number, toIdx: number, route: any) {
    const expectedSeq = this.expectedTrainSeqBetween(fromIdx, toIdx, route);
    for (let ci = 0; ci < Math.min(3, journeys.length); ci++) {
      const vb = (journeys as any)[ci]?.verbindung;
      if (!vb) continue;
      const seq = this.extractTrainSequence(vb);
      const equal = seq.length === expectedSeq.length && seq.every((v: any, idx: number) => v === expectedSeq[idx]);
      if (equal && vb.kontext) return vb;
    }
    return null;
  }

  extractTrainSequence(journey: any) {
    const seq: string[] = [];
    const secs = journey?.verbindungsAbschnitte || [];
    for (const s of secs) {
      if (s?.typ !== 'FAHRZEUG') continue;
      const lab = (s.mitteltext || s.langtext || s.kurztext || s.risZuglaufId || s.zuglaufId || '').trim();
      if (!seq.length || seq[seq.length - 1] !== lab) seq.push(lab);
    }
    return seq;
  }

  expectedTrainSeqBetween(i: number, j: number, route: any) {
    const seq: string[] = [];
    if (!route?.nodes) return seq;
    for (let k = i; k <= j; k++) {
      const lbl = route.nodes[k]?.trainLabel || null;
      if (!lbl) continue;
      if (!seq.length || seq[seq.length - 1] !== lbl) seq.push(lbl);
    }
    return seq;
  }

  async fetchOffers(journey: any, options: any) {
    const recon = await dbnavRefreshTickets({ refreshToken: journey.kontext, opts: options });
    const offers: any[] = [];
    this.walkOffers(recon?.angebote || {}, offers);
    return offers;
  }

  walkOffers(obj: any, offers: any[]) {
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
            offers.push({ name: ef?.name || 'Angebot', amount: preis.betrag, currency: preis.waehrung || 'EUR' });
          }
        }
      }
    }
  }

  findBestOffer(offers: any[]) {
    return offers.length ? offers.reduce((a, b) => (a.amount <= b.amount ? a : b)) : null;
  }

  isRetryableError(e: any) {
    return e?.message?.includes?.('rate limit') || e?.message?.includes?.('timeout') || e?.message?.includes?.('network') || e?.status >= 500;
  }

  async withRetry<T>(fn: (attempt: number) => Promise<T>) {
    let lastError: any;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (e: any) {
        lastError = e;
        if (attempt === this.maxRetries || !this.isRetryableError(e)) break;
      }
    }
    throw lastError;
  }
}

