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
    else if (msg.phase === 'segments-start') log(`Pricing segments (cap ${msg.cap}, nodes ${msg.totalNodes})…`);
    else if (msg.phase === 'segment-pricing') log(`Pricing ${msg.fromIdx}→${msg.toIdx} (${msg.fromEva}→${msg.toEva})…`);
    else if (msg.phase === 'segment-priced') log(`${msg.fromIdx}→${msg.toIdx} ${msg.ok ? 'ok' : 'fail'}` + (msg.error ? ` (${msg.error})` : ''));
    else if (msg.phase === 'segments-done') log(`Segments done: ${msg.produced}`);
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
        // Render offers if present
        const ti = res.summary?.ticketsInfo;
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
