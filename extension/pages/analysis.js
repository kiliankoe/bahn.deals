function $(id) { return document.getElementById(id); }
const EXT = (typeof browser !== 'undefined' && browser) || (typeof chrome !== 'undefined' && chrome);

async function main() {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  let selection = null;
  if (token) {
    try {
      const res = await EXT.runtime.sendMessage({ type: 'get-analysis-selection', token });
      selection = res?.selection || null;
    } catch {}
  }

  const routeEl = $('#route');
  const metaEl = $('#meta');
  const progressEl = $('#progress');
  const detailsEl = $('#details');

  if (!selection) {
    if (routeEl) routeEl.textContent = 'bahn.deals – Analyse';
    if (metaEl) metaEl.textContent = '';
    if (progressEl) progressEl.textContent = 'Keine übergebene Verbindung gefunden.';
    if (detailsEl) detailsEl.textContent = 'Öffnen Sie das Menü einer Verbindung auf bahn.de und wählen Sie „Günstigste Aufteilung suchen“.';
    // continue to attach button handler below
  }

  if (selection) {
    const { fromName, toName, depTime, arrTime, dateTimeParam, lines } = selection;
    if (routeEl) routeEl.textContent = `${fromName || 'Start'} → ${toName || 'Ziel'}`;
    if (metaEl) metaEl.textContent = `${depTime || '?'} – ${arrTime || '?'}  |  ${dateTimeParam || ''}`;
    if (progressEl) progressEl.textContent = 'Verbindungsdaten erhalten. Analyse in Vorbereitung …';
    if (detailsEl) detailsEl.textContent = `Verkehrsmittel: ${Array.isArray(lines) && lines.length ? lines.join(', ') : 'unbekannt'}`;
  }

  const runBtn = document.getElementById('run');
  const result = document.getElementById('result');
  const bestWrap = document.getElementById('best-offer');
  const bestText = document.getElementById('best-offer-text');
  const offersWrap = document.getElementById('offers-list');
  const offersUl = document.getElementById('offers');
  const segmentsWrap = document.getElementById('segments-list');
  const segmentsUl = document.getElementById('segments');
  const progressLog = document.getElementById('progress-log');
  const summaryBanner = document.getElementById('summary-banner');
  const originalPrice = document.getElementById('original-price');
  const bestSplitPrice = document.getElementById('best-split-price');
  const savingsEl = document.getElementById('savings');
  const chosenSegments = document.getElementById('chosen-segments');
  const chosenSegmentsList = document.getElementById('chosen-segments-list');

  const log = (line) => {
    if (!progressLog) return;
    const div = document.createElement('div');
    div.textContent = line;
    progressLog.appendChild(div);
    progressLog.scrollTop = progressLog.scrollHeight;
  };

  EXT.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'analysis-progress') return;
    if (msg.phase === 'init') log(`Init: EVA ${msg.fromEva} → ${msg.toEva} @ ${msg.depDateTime}`);
    else if (msg.phase === 'journeys-fetched') log(`Found ${msg.journeysCount} journeys`);
    else if (msg.phase === 'route-parsed') log(`Route parsed: ${msg.nodes} Halte`);
    else if (msg.phase === 'segments-start') log(`Pricing ${msg.total} segments (nodes ${msg.totalNodes})…`);
    else if (msg.phase === 'segment-pricing') log(`Pricing ${msg.fromIdx}→${msg.toIdx} (${msg.fromEva}→${msg.toEva})…`);
    else if (msg.phase === 'segment-priced') log(`${msg.fromIdx}→${msg.toIdx} ${msg.ok ? 'ok' : 'fail'}` + (msg.error ? ` (${msg.error})` : ''));
    else if (msg.phase === 'segments-progress') log(`Progress: ${msg.done}/${msg.total} segments (${Math.round(msg.done/msg.total*100)}%)`);
    else if (msg.phase === 'segments-done') log(`Segments done: ${msg.produced}/${msg.total}`);
    else if (msg.phase === 'dp-start') log(`Computing best split from ${msg.validSegments} valid segments…`);
    else if (msg.phase === 'dp-done' && !msg.error) log(`Best split found: ${msg.segmentsUsed} segments, total ${msg.totalCost.toFixed(2)} EUR`);
    else if (msg.phase === 'dp-done' && msg.error) log(`DP optimization failed: ${msg.error}`);
  });
  if (runBtn) runBtn.addEventListener('click', async () => {
    if (!EXT?.runtime?.sendMessage) {
      if (result) result.textContent = 'API nicht verfügbar.';
      return;
    }
    if (result) result.textContent = 'Analysiere …';
    if (progressLog) progressLog.textContent = '';
    try {
      const res = await EXT.runtime.sendMessage({ type: 'start-analysis', token });
      if (!res?.ok) {
        if (result) result.textContent = 'Fehler beim Starten der Analyse.' + (res?.error ? `\n${res.error}` : '');
      } else {
        if (result) result.textContent = JSON.stringify(res.summary, null, 2);
        
        // Render summary banner
        const ti = res.summary?.ticketsInfo;
        const split = res.summary?.split;
        const route = res.summary?.route;
        
        if (split && ti?.bestOffer && !split.error) {
          const originalAmount = ti.bestOffer.amount;
          const splitAmount = split.total;
          const savings = originalAmount - splitAmount;
          const savingsPercent = originalAmount > 0 ? (savings / originalAmount * 100) : 0;
          
          originalPrice.textContent = `${originalAmount.toFixed(2)} ${ti.bestOffer.currency}`;
          bestSplitPrice.textContent = `${splitAmount.toFixed(2)} ${split.currency}`;
          
          if (savings > 0.01) {
            savingsEl.textContent = `${savings.toFixed(2)} ${ti.bestOffer.currency} (${savingsPercent.toFixed(1)}%)`;
            savingsEl.style.color = '#28a745';
          } else if (savings < -0.01) {
            savingsEl.textContent = `+${Math.abs(savings).toFixed(2)} ${ti.bestOffer.currency} (${Math.abs(savingsPercent).toFixed(1)}%)`;
            savingsEl.style.color = '#dc3545';
          } else {
            savingsEl.textContent = 'Kein Unterschied';
            savingsEl.style.color = '#6c757d';
          }
          
          // Show chosen segments
          if (Array.isArray(split.segments) && split.segments.length && route?.nodes) {
            const segmentTexts = [];
            for (const seg of split.segments) {
              const fromNode = route.nodes[seg.fromIdx];
              const toNode = route.nodes[seg.toIdx];
              const fromName = fromNode?.name || fromNode?.eva || '?';
              const toName = toNode?.name || toNode?.eva || '?';
              segmentTexts.push(`${fromName} → ${toName} (${seg.amount.toFixed(2)} ${seg.currency})`);
            }
            chosenSegmentsList.textContent = segmentTexts.join(' + ');
            chosenSegments.style.display = '';
          } else {
            chosenSegments.style.display = 'none';
          }
          
          summaryBanner.style.display = '';
        } else if (split?.error && ti?.bestOffer) {
          // Show error state in summary banner
          originalPrice.textContent = `${ti.bestOffer.amount.toFixed(2)} ${ti.bestOffer.currency}`;
          bestSplitPrice.textContent = 'Fehler';
          savingsEl.textContent = split.error === 'no-path-found' ? 'Keine vollständige Aufteilung möglich' : `Fehler: ${split.error}`;
          savingsEl.style.color = '#dc3545';
          chosenSegments.style.display = 'none';
          summaryBanner.style.display = '';
        } else {
          summaryBanner.style.display = 'none';
        }
        
        // Render offers if present
        if (ti && ti.bestOffer) {
          bestText.textContent = `${ti.bestOffer.name} – ${ti.bestOffer.amount.toFixed(2)} ${ti.bestOffer.currency}`;
          bestWrap.style.display = '';
        } else {
          bestWrap.style.display = 'none';
        }
        if (ti && Array.isArray(ti.offers) && ti.offers.length) {
          offersUl.innerHTML = '';
          for (const o of ti.offers) {
            const li = document.createElement('li');
            li.textContent = `${o.name} – ${o.amount.toFixed(2)} ${o.currency}`;
            offersUl.appendChild(li);
          }
          offersWrap.style.display = '';
        } else {
          offersWrap.style.display = 'none';
        }
        // Render segments (subset)
        const segs = res.summary?.segments;
        if (Array.isArray(segs) && segs.length) {
          segmentsUl.innerHTML = '';
          for (const s of segs) {
            if (!s?.bestOffer) continue;
            const li = document.createElement('li');
            const from = s.from?.name || s.from?.eva || '?';
            const to = s.to?.name || s.to?.eva || '?';
            li.textContent = `${from} → ${to} – ${s.bestOffer.amount.toFixed(2)} ${s.bestOffer.currency}`;
            segmentsUl.appendChild(li);
          }
          segmentsWrap.style.display = '';
        } else {
          segmentsWrap.style.display = 'none';
        }
      }
    } catch (e) {
      if (result) result.textContent = 'Unerwarteter Fehler. ' + (e && e.message ? e.message : '');
    }
  });
}

document.addEventListener('DOMContentLoaded', main);
