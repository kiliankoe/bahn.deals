const sessionStore = new Map();
const DEFAULT_OPTIONS = { class: '2', age: 30, bahncard: 'none', dticket: false };

const genToken = () => `bd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "open-analysis" && msg.selection) {
    const token = genToken();
    sessionStore.set(token, { selection: msg.selection, createdAt: Date.now() });
    const url = browser.runtime.getURL(`pages/analysis.html?token=${encodeURIComponent(token)}`);
    await browser.tabs.create({ url });
    return { ok: true, token };
  }

  if (msg.type === "get-analysis-selection" && msg.token) {
    const entry = sessionStore.get(msg.token);
    return { selection: entry?.selection || null };
  }

  if (msg.type === "cleanup-session" && msg.token) {
    sessionStore.delete(msg.token);
    return { ok: true };
  }

  if (msg.type === "get-options") {
    const { options } = await browser.storage.local.get('options');
    return { options: { ...DEFAULT_OPTIONS, ...(options || {}) } };
  }

  if (msg.type === "set-options" && msg.options) {
    const next = { ...DEFAULT_OPTIONS, ...msg.options };
    await browser.storage.local.set({ options: next });
    return { ok: true };
  }

  if (msg.type === "start-analysis" && msg.token) {
    const progress = async (payload) => {
      try { await browser.runtime.sendMessage({ type: 'analysis-progress', ...payload }); } catch {}
    };
    const { options } = await browser.storage.local.get('options');
    const userOptions = { ...DEFAULT_OPTIONS, ...(options || {}) };
    const entry = sessionStore.get(msg.token);
    if (!entry) return { ok: false, error: 'no-session' };

    try {
      const sel = entry.selection || {};
      // Determine date/time from selection
      let hd = sel.dateTimeParam;
      if (!hd && sel.pageUrl) {
        hd = self.DBNavLite?.parseHd(sel.pageUrl) || null;
      }
      // Parse dep time HH:MM
      const [hh, mm] = (sel.depTime || '').split(':').map(x => parseInt(x, 10));
      let y, m, d;
      if (hd) {
        const dt = new Date(hd);
        y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
      } else {
        const now = new Date();
        y = now.getFullYear(); m = now.getMonth() + 1; d = now.getDate();
      }
      const depDateTime = self.DBNavLite.formatBerlinDateTime(y, m, d, isNaN(hh)?8:hh, isNaN(mm)?0:mm, 0);

      // Resolve station EVA numbers
      let fromEva = sel.fromEVA || null;
      let toEva = sel.toEVA || null;
      if (!fromEva && sel.fromName) {
        const res = await self.DBNavLite.dbnavLocations(sel.fromName, 5);
        fromEva = res?.[0]?.evaNr || null;
      }
      if (!toEva && sel.toName) {
        const res = await self.DBNavLite.dbnavLocations(sel.toName, 5);
        toEva = res?.[0]?.evaNr || null;
      }
      if (!fromEva || !toEva) {
        return { ok: false, error: 'resolve-failed', selection: sel };
      }

      console.debug('[analysis] computed', { fromEva, toEva, depDateTime });
      await progress({ phase: 'init', fromEva, toEva, depDateTime });
      // Fetch journeys
      const j = await self.DBNavLite.dbnavJourneys({ fromEva, toEva, depDateTime, opts: userOptions });
      const journeys = Array.isArray(j?.verbindungen) ? j.verbindungen : [];
      const first = journeys[0]?.verbindung || null;
      await progress({ phase: 'journeys-fetched', journeysCount: journeys.length });

      let ticketsInfo = null;
      let route = null;
      if (first?.kontext) {
        try {
          const recon = await self.DBNavLite.dbnavRefreshTickets({ refreshToken: first.kontext, opts: userOptions });
          // extract route nodes from recon.verbindung.verbindungsAbschnitte
          try {
            const abschnitte = recon?.verbindung?.verbindungsAbschnitte || [];
            const nodes = [];
            for (let ai = 0; ai < abschnitte.length; ai++) {
              const sec = abschnitte[ai];
              const secLabel = (sec.mitteltext || sec.langtext || sec.kurztext || sec.risZuglaufId || sec.zuglaufId || '').trim() || null;
              const halts = Array.isArray(sec?.halte) ? sec.halte : [];
              for (let hi = 0; hi < halts.length; hi++) {
                const h = halts[hi];
                const eva = h?.ort?.evaNr || h?.ort?.locationId?.match(/L=(\d+)@/i)?.[1] || null;
                const name = h?.ort?.name || null;
                const dep = h?.abgangsDatum || null;
                const arr = h?.ankunftsDatum || null;
                if (!eva) continue;
                const last = nodes.at(-1);
                if (!last || last.eva !== eva) nodes.push({ eva, name, dep, arr, secIndex: ai, trainLabel: sec.typ === 'FAHRZEUG' ? secLabel : null });
                else {
                  // merge times if same EVA repeats
                  if (dep) last.dep = dep;
                  if (arr) last.arr = arr;
                  if (!last.trainLabel && sec.typ === 'FAHRZEUG') last.trainLabel = secLabel;
                }
              }
            }
            route = { nodes };
            await progress({ phase: 'route-parsed', nodes: nodes.length });
          } catch {}
          const offers = [];
          const walk = (obj) => {
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
                    offers.push({
                      name: ef?.name || 'Angebot',
                      amount: preis.betrag,
                      currency: preis.waehrung || 'EUR',
                      klass: ef?.lupKategorien?.klasse || null,
                      art: ef?.lupKategorien?.angebotsArt || null,
                    });
                  }
                }
              }
            }
          };
          walk(recon?.angebote || {});

          const best = offers.length ? offers.reduce((a,b)=> (a.amount <= b.amount ? a : b)) : null;
          ticketsInfo = {
            hasAngebote: !!recon?.angebote,
            angebotseinholungNachgelagert: recon?.angebote?.angebotseinholungNachgelagert ?? null,
            angebotsMeldungen: recon?.angebote?.angebotsMeldungen ?? null,
            offers: offers.slice(0, 10),
            bestOffer: best,
          };
        } catch (e) {
          ticketsInfo = { error: String(e?.message || e) };
        }
      }

      // Price a subset of segments sequentially (prototype)
      const segments = [];
      const expectedTrainSeqBetween = (i, j) => {
        const seq = [];
        if (!route?.nodes) return seq;
        for (let k = i; k <= j; k++) {
          const lbl = route.nodes[k]?.trainLabel || null;
          if (!lbl) continue;
          if (!seq.length || seq[seq.length - 1] !== lbl) seq.push(lbl);
        }
        return seq;
      };
      const priceOne = async (fromIdx, toIdx) => {
        try {
          const fromNode = route?.nodes?.[fromIdx];
          const toNode = route?.nodes?.[toIdx];
          if (!fromNode || !toNode) return null;
          if (!fromNode.dep) return null; // need a departure time
          // Use precise dep from route
          const depDT = fromNode.dep; // ISO string from API
          await progress({ phase: 'segment-pricing', fromIdx, toIdx, fromEva: fromNode.eva, toEva: toNode.eva });
          // Price segment with strict route match
          const j2 = await self.DBNavLite.dbnavJourneys({ fromEva: fromNode.eva, toEva: toNode.eva, depDateTime: depDT, opts: userOptions });
          const expectedSeq = expectedTrainSeqBetween(fromIdx, toIdx);
          let picked = null;
          const candList = Array.isArray(j2?.verbindungen) ? j2.verbindungen : [];
          for (let ci = 0; ci < Math.min(3, candList.length); ci++) {
            const vb = candList[ci]?.verbindung;
            if (!vb) continue;
            const secs = vb?.verbindungsAbschnitte || [];
            const seq = [];
            for (const s of secs) {
              if (s?.typ !== 'FAHRZEUG') continue;
              const lab = (s.mitteltext || s.langtext || s.kurztext || s.risZuglaufId || s.zuglaufId || '').trim();
              if (!seq.length || seq[seq.length - 1] !== lab) seq.push(lab);
            }
            const equal = seq.length === expectedSeq.length && seq.every((v, idx) => v === expectedSeq[idx]);
            if (equal && vb.kontext) { picked = vb; break; }
          }
          if (!picked) return { fromIdx, toIdx, error: 'route-mismatch' };
          const recon2 = await self.DBNavLite.dbnavRefreshTickets({ refreshToken: picked.kontext, opts: userOptions });
          // parse offers like above
          const offers2 = [];
          const walk2 = (obj) => {
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
                    offers2.push({
                      name: ef?.name || 'Angebot',
                      amount: preis.betrag,
                      currency: preis.waehrung || 'EUR',
                    });
                  }
                }
              }
            }
          };
          walk2(recon2?.angebote || {});
          const best2 = offers2.length ? offers2.reduce((a,b)=> (a.amount <= b.amount ? a : b)) : null;
          const result = {
            fromIdx, toIdx,
            from: { eva: fromNode.eva, name: fromNode.name },
            to: { eva: toNode.eva, name: toNode.name },
            bestOffer: best2,
            offersCount: offers2.length,
          };
          await progress({ phase: 'segment-priced', fromIdx, toIdx, ok: !!best2 });
          return result;
        } catch (e) {
          await progress({ phase: 'segment-priced', fromIdx, toIdx, ok: false, error: String(e?.message || e) });
          return { fromIdx, toIdx, error: String(e?.message || e) };
        }
      };
      try {
        const n = route?.nodes?.length || 0;
        const total = n > 1 ? (n * (n - 1)) / 2 : 0;
        await progress({ phase: 'segments-start', totalNodes: n, total });
        const tasks = [];
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) tasks.push([i, j]);
        }
        let done = 0;
        const concurrency = 3; // Increased for better throughput
        const throttleMs = 100; // Reduced throttle for faster processing
        const runNext = async () => {
          while (tasks.length > 0) {
            const t = tasks.shift();
            if (!t) break;
            const [i, j] = t;
            try {
              const r = await priceOne(i, j);
              if (r) segments.push(r);
            } catch (e) {
              console.warn(`[segments] pricing ${i}->${j} failed:`, e);
            } finally {
              done++;
              // Report progress more frequently for large segment counts
              if (done % Math.max(1, Math.floor(total / 20)) === 0 || done === total) {
                await progress({ phase: 'segments-progress', done, total });
              }
            }
            // Throttle between requests
            if (tasks.length > 0) {
              await new Promise(res => setTimeout(res, throttleMs));
            }
          }
        };
        await Promise.all(Array.from({ length: concurrency }, runNext));
        await progress({ phase: 'segments-done', produced: segments.length, total });
        await progress({ phase: 'dp-start', validSegments: segments.filter(s => s?.bestOffer?.amount != null).length });
      } catch (e) {
        console.error('[segments] processing error:', e);
      }

      // Compute DP for best split across all priced segments
      let split = null;
      try {
        const n = route?.nodes?.length || 0;
        if (n >= 2) {
          // Build cost matrix from all successfully priced segments
          const cost = new Map();
          const segmentMap = new Map(); // Store full segment info for reconstruction
          let validSegments = 0;
          for (const s of segments) {
            if (s?.bestOffer?.amount != null && s.fromIdx != null && s.toIdx != null) {
              const key = `${s.fromIdx}-${s.toIdx}`;
              cost.set(key, s.bestOffer.amount);
              segmentMap.set(key, s);
              validSegments++;
            }
          }
          
          console.debug(`[DP] processing ${n} nodes with ${validSegments} valid segments`);
          
          // Dynamic Programming to find minimum cost path
          const INF = 1e15;
          const dp = Array(n).fill(INF);
          const prev = Array(n).fill(-1);
          dp[0] = 0;
          
          for (let j = 1; j < n; j++) {
            for (let i = 0; i < j; i++) {
              const key = `${i}-${j}`;
              const c = cost.get(key);
              if (c == null) continue;
              if (dp[i] + c < dp[j]) {
                dp[j] = dp[i] + c;
                prev[j] = i;
              }
            }
          }
          
          // Reconstruct path if solution exists
          if (dp[n - 1] < INF) {
            const chosen = [];
            let cur = n - 1;
            let totalCost = 0;
            
            while (cur > 0 && prev[cur] >= 0) {
              const i = prev[cur];
              const j = cur;
              const key = `${i}-${j}`;
              const segment = segmentMap.get(key);
              
              if (segment) {
                chosen.push({
                  fromIdx: i,
                  toIdx: j,
                  amount: segment.bestOffer.amount,
                  currency: segment.bestOffer.currency || 'EUR',
                  from: segment.from,
                  to: segment.to
                });
                totalCost += segment.bestOffer.amount;
              }
              cur = i;
            }
            
            chosen.reverse();
            split = {
              total: totalCost,
              currency: 'EUR',
              segments: chosen,
              dpCost: dp[n - 1], // For debugging
              validSegmentsUsed: chosen.length,
              totalValidSegments: validSegments
            };
            
            console.debug(`[DP] found solution: ${chosen.length} segments, total cost ${totalCost}`);
            await progress({ phase: 'dp-done', segmentsUsed: chosen.length, totalCost });
          } else {
            console.warn(`[DP] no valid path found from start to end (${validSegments} segments available)`);
            split = {
              error: 'no-path-found',
              totalValidSegments: validSegments,
              nodeCount: n
            };
            await progress({ phase: 'dp-done', error: 'no-path-found' });
          }
        }
      } catch (e) {
        console.error('[DP] optimization error:', e);
        split = {
          error: String(e?.message || e),
          segmentsCount: segments.length
        };
      }

      return {
        ok: true,
        summary: {
          note: 'dbnav integrated: journeys fetched',
          depDateTime,
          userOptions,
          selection: sel,
          fromEva, toEva,
          journeysCount: journeys.length,
          firstContext: first?.kontext || null,
          ticketsInfo,
          route,
          segments,
          split,
        },
      };
    } catch (err) {
      console.error('[analysis] error', err);
      return { ok: false, error: String(err && err.message || err) };
    }
  }
});
