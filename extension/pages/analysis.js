function $(id) { return document.getElementById(id); }
const EXT = (typeof browser !== 'undefined' && browser) || (typeof chrome !== 'undefined' && chrome);

// Initialize map variable
let map = null;
let routePolyline = null;
let markersLayer = null;

// Helper function to create map
function initializeMap() {
  if (!map && typeof L !== 'undefined') {
    map = L.map('map').setView([51.1657, 10.4515], 6); // Germany center
    
    // Try vector tiles first if MapLibre GL is available
    if (typeof L.maplibreGL !== 'undefined') {
      try {
        L.maplibreGL({
          style: 'https://tiles.openfreemap.org/styles/bright',
          attribution: 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
      } catch (e) {
        console.warn('MapLibre GL failed, falling back to raster tiles:', e);
        // Fallback to standard OSM raster tiles
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);
      }
    } else {
      // Use standard OSM raster tiles if MapLibre GL not available
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);
    }
  }
  return map;
}

// Helper to add route to map
function displayRoute(nodes) {
  console.debug('displayRoute called with nodes:', nodes);
  console.debug('displayRoute - first node:', JSON.stringify(nodes?.[0], null, 2));
  console.debug('displayRoute - all nodes:', nodes?.map(n => ({ name: n.name, hasLocation: !!n.location, location: n.location })));
  console.debug('displayRoute - nodes with location:', nodes?.filter(n => n.location).length, 'of', nodes?.length);
  console.debug('displayRoute - nodes without location:', nodes?.filter(n => !n.location).map(n => n.name));
  if (!map || !nodes || nodes.length < 2 || typeof L === 'undefined') return;
  
  // Clear existing route and markers
  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }
  if (markersLayer) {
    map.removeLayer(markersLayer);
    markersLayer = null;
  }
  
  // Create new layer group for markers
  markersLayer = L.layerGroup().addTo(map);
  
  // Extract coordinates - try both coordinate orders since APIs vary
  const coordinates = nodes
    .filter(n => n.location?.latitude && n.location?.longitude)
    .map(n => {
      // Leaflet expects [latitude, longitude] order
      return [n.location.latitude, n.location.longitude];
    });
  
  console.debug('Extracted coordinates:', coordinates);
  console.debug('Coordinates length vs nodes length:', coordinates.length, 'vs', nodes.length);
  
  // Debug each node
  nodes.forEach((node, idx) => {
    console.debug(`Node ${idx}: ${node.name} - Has location: ${!!node.location}`, node.location);
  });
  
  if (coordinates.length < 2) {
    console.warn('Not enough coordinates to display route. Nodes with location:', nodes.filter(n => n.location));
    // Show a warning message
    const mapInfo = $('#map-info');
    if (mapInfo) {
      mapInfo.innerHTML = '<span style="color: #dc3545;">⚠ Nicht genügend Koordinaten verfügbar. Bitte versuchen Sie es später erneut.</span>';
    }
    return;
  }
  
  // Check if we're missing some coordinates
  if (coordinates.length < nodes.length) {
    const missingStations = nodes.filter(n => !n.location).map(n => n.name).join(', ');
    console.warn(`Missing coordinates for ${nodes.length - coordinates.length} stations: ${missingStations}`);
  }
  
  // Add markers for all stations with letter labels
  for (let i = 0; i < coordinates.length; i++) {
    const node = nodes[i];
    const coord = coordinates[i];
    const letter = String.fromCharCode(65 + i); // A, B, C, D...
    const isStartOrEnd = i === 0 || i === coordinates.length - 1;
    const isTransferStation = node.name && (node.name.includes('Hbf') || node.name.includes('Hauptbahnhof'));
    
    // Use larger markers with letters for all stations
    L.marker(coord, {
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div style='background-color:${isStartOrEnd ? '#EC0016' : isTransferStation ? '#EC0016' : '#666'};color:white;border-radius:50%;width:${isStartOrEnd ? 30 : 24}px;height:${isStartOrEnd ? 30 : 24}px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${isStartOrEnd ? 16 : 14}px;'>${letter}</div>`,
        iconSize: isStartOrEnd ? [30, 30] : [24, 24],
        iconAnchor: isStartOrEnd ? [15, 15] : [12, 12]
      })
    }).addTo(markersLayer).bindPopup(
      `<strong>${letter}: ${node.name || 'Station'}</strong><br>` +
      `${node.trainLabel ? `Zug: ${node.trainLabel}<br>` : ''}` +
      `${node.arr ? `Ankunft: ${new Date(node.arr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}<br>` : ''}` +
      `${node.dep ? `Abfahrt: ${new Date(node.dep).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}`
    );
  }
  
  // Draw route line
  routePolyline = L.polyline(coordinates, {
    color: '#EC0016',
    weight: 4,
    opacity: 0.8
  }).addTo(map);
  
  // Fit map to route
  map.fitBounds(routePolyline.getBounds().pad(0.1));
  
  // Update info
  const mapInfo = $('#map-info');
  if (mapInfo) {
    const intermediateStops = nodes.length - 2;
    const distance = Math.round(routePolyline.getBounds().getNorthEast().distanceTo(routePolyline.getBounds().getSouthWest()) / 1000);
    let infoText = `Route: ${nodes.length} Stationen (${intermediateStops > 0 ? `${intermediateStops} Zwischenhalte` : 'Direktverbindung'}), ca. ${distance} km Luftlinie`;
    
    // Add warning if some stations are missing coordinates
    if (coordinates.length < nodes.length) {
      const missingCount = nodes.length - coordinates.length;
      infoText += ` <span style="color: #ff6b00;">⚠ ${missingCount} Station${missingCount > 1 ? 'en' : ''} ohne Koordinaten</span>`;
    }
    
    mapInfo.innerHTML = infoText;
  }
}

// Helper to format duration
function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}

// Helper to copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

// Helper to fetch initial route data for map display
async function fetchInitialRoute(token) {
  if (!token) return;
  
  try {
    const res = await EXT.runtime.sendMessage({ type: 'fetch-route-only', token });
    console.debug('fetchInitialRoute response:', res);
    if (res?.ok && res.route?.nodes && res.route.nodes.length > 1) {
      console.debug('Route nodes:', res.route.nodes);
      const mapContainer = document.getElementById('map-container');
      const progressEl = document.getElementById('progress');
      
      // Show map
      if (mapContainer) {
        mapContainer.style.display = '';
        setTimeout(() => {
          initializeMap();
          displayRoute(res.route.nodes);
        }, 100);
      }
      
      // Add journey info
      const headerEl = document.querySelector('header');
      if (headerEl) {
        // Calculate duration - check both field names for compatibility
        const startTime = res.route.nodes[0]?.departure || res.route.nodes[0]?.dep;
        const endTime = res.route.nodes[res.route.nodes.length - 1]?.arrival || res.route.nodes[res.route.nodes.length - 1]?.arr;
        let durationText = '';
        if (startTime && endTime) {
          const start = new Date(startTime);
          const end = new Date(endTime);
          const durationMs = end - start;
          if (durationMs > 0) {
            const minutes = Math.floor(durationMs / 60000);
            durationText = formatDuration(minutes);
          }
        }
        
        // Count changes
        const changes = res.route.legs ? res.route.legs.length - 1 : 0;
        
        // Create journey info section
        let journeyInfo = document.querySelector('.journey-info');
        if (!journeyInfo && (durationText || changes >= 0)) {
          journeyInfo = document.createElement('div');
          journeyInfo.className = 'journey-info';
          headerEl.appendChild(journeyInfo);
          
          if (durationText) {
            const durationItem = document.createElement('div');
            durationItem.className = 'journey-info-item';
            durationItem.innerHTML = `<div class="journey-info-label">Reisedauer</div><div class="journey-info-value">${durationText}</div>`;
            journeyInfo.appendChild(durationItem);
          }
          
          const changesItem = document.createElement('div');
          changesItem.className = 'journey-info-item';
          changesItem.innerHTML = `<div class="journey-info-label">Umstiege</div><div class="journey-info-value">${changes}</div>`;
          journeyInfo.appendChild(changesItem);
          
          if (res.route.nodes.length > 0) {
            const stopsItem = document.createElement('div');
            stopsItem.className = 'journey-info-item';
            stopsItem.innerHTML = `<div class="journey-info-label">Halte</div><div class="journey-info-value">${res.route.nodes.length}</div>`;
            journeyInfo.appendChild(stopsItem);
          }
        }
      }
      
      if (progressEl) progressEl.textContent = 'Verbindungsdaten geladen. Bereit für Analyse.';
    } else {
      if (progressEl) progressEl.textContent = 'Verbindungsdaten erhalten. Analyse in Vorbereitung …';
      console.debug('Could not fetch initial route:', res?.error);
    }
  } catch (e) {
    const progressEl = document.getElementById('progress');
    if (progressEl) progressEl.textContent = 'Verbindungsdaten erhalten. Analyse in Vorbereitung …';
    console.debug('Error fetching initial route:', e);
  }
}

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
    if (progressEl) progressEl.textContent = 'Lade Streckendaten für Kartenanzeige...';
    if (detailsEl) detailsEl.textContent = `Verkehrsmittel: ${Array.isArray(lines) && lines.length ? lines.join(', ') : 'unbekannt'}`;
    
    // Fetch route data immediately to show map
    fetchInitialRoute(token);
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
  const copySegmentsBtn = document.getElementById('copy-segments');
  const progressLogHeader = document.getElementById('progress-log-header');
  const mapContainer = document.getElementById('map-container');
  
  // Option controls
  const classSelect = document.getElementById('class-select');
  const ageInput = document.getElementById('age-input');
  const bahncardSelect = document.getElementById('bahncard-select');
  const dticketCheck = document.getElementById('dticket-check');

  // Load saved options
  async function loadOptions() {
    try {
      const res = await EXT.runtime.sendMessage({ type: 'get-options' });
      if (res?.options) {
        if (classSelect) classSelect.value = res.options.class || '2';
        if (ageInput) ageInput.value = res.options.age || 30;
        if (bahncardSelect) bahncardSelect.value = res.options.bahncard || 'none';
        if (dticketCheck) dticketCheck.checked = res.options.dticket || false;
      }
    } catch (e) {
      console.error('Failed to load options:', e);
    }
  }

  // Save options when changed
  async function saveOptions() {
    const options = {
      class: classSelect?.value || '2',
      age: parseInt(ageInput?.value || '30', 10),
      bahncard: bahncardSelect?.value || 'none',
      dticket: dticketCheck?.checked || false
    };
    try {
      await EXT.runtime.sendMessage({ type: 'set-options', options });
    } catch (e) {
      console.error('Failed to save options:', e);
    }
  }

  // Attach change listeners
  if (classSelect) classSelect.addEventListener('change', saveOptions);
  if (ageInput) ageInput.addEventListener('change', saveOptions);
  if (bahncardSelect) bahncardSelect.addEventListener('change', saveOptions);
  if (dticketCheck) dticketCheck.addEventListener('change', saveOptions);

  // Load options on page load
  loadOptions();
  
  // Setup collapsible progress log
  if (progressLogHeader) {
    progressLogHeader.addEventListener('click', () => {
      const isCollapsed = progressLogHeader.classList.contains('collapsed');
      progressLogHeader.classList.toggle('collapsed');
      if (progressLog) {
        progressLog.style.display = isCollapsed ? 'block' : 'none';
      }
    });
  }
  
  // Setup copy segments button
  if (copySegmentsBtn) {
    copySegmentsBtn.addEventListener('click', async () => {
      const text = chosenSegmentsList?.textContent || '';
      const success = await copyToClipboard(text);
      const originalText = copySegmentsBtn.textContent;
      copySegmentsBtn.textContent = success ? 'Kopiert! ✓' : 'Fehler beim Kopieren';
      setTimeout(() => {
        copySegmentsBtn.textContent = originalText;
      }, 2000);
    });
  }

  const log = (line) => {
    if (!progressLog) return;
    const div = document.createElement('div');
    div.textContent = line;
    progressLog.appendChild(div);
    progressLog.scrollTop = progressLog.scrollHeight;
  };

  EXT.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'analysis-progress') return;
    
    // Update main progress text
    if (msg.phase === 'init') {
      if (progressEl) progressEl.textContent = 'Initialisiere Analyse...';
      log(`Init: EVA ${msg.fromEva} → ${msg.toEva} @ ${msg.depDateTime}`);
    } else if (msg.phase === 'journeys-fetched') {
      if (progressEl) progressEl.textContent = `${msg.journeysCount} Verbindungen gefunden, analysiere Route...`;
      log(`Found ${msg.journeysCount} journeys`);
    } else if (msg.phase === 'route-parsed') {
      if (progressEl) progressEl.textContent = `Route analysiert (${msg.nodes} Halte), preise Segmente...`;
      log(`Route parsed: ${msg.nodes} Halte`);
      
      // Show map and journey info as soon as route is parsed (only if not already visible)
      if (msg.route?.nodes && msg.route.nodes.length > 1) {
        // Show map only if not already displayed
        if (mapContainer && mapContainer.style.display === 'none') {
          mapContainer.style.display = '';
          setTimeout(() => {
            initializeMap();
            displayRoute(msg.route.nodes);
          }, 100);
        }
        
        // Add journey info only if not already present
        const headerEl = document.querySelector('header');
        if (headerEl && !document.querySelector('.journey-info')) {
          // Calculate duration - check both field names for compatibility
          const startTime = msg.route.nodes[0]?.departure || msg.route.nodes[0]?.dep;
          const endTime = msg.route.nodes[msg.route.nodes.length - 1]?.arrival || msg.route.nodes[msg.route.nodes.length - 1]?.arr;
          let durationText = '';
          if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const durationMs = end - start;
            if (durationMs > 0) {
              const minutes = Math.floor(durationMs / 60000);
              durationText = formatDuration(minutes);
            }
          }
          
          // Count changes
          const changes = msg.route.legs ? msg.route.legs.length - 1 : 0;
          
          // Create journey info section if it doesn't exist
          let journeyInfo = document.querySelector('.journey-info');
          if (!journeyInfo && (durationText || changes >= 0)) {
            journeyInfo = document.createElement('div');
            journeyInfo.className = 'journey-info';
            headerEl.appendChild(journeyInfo);
            
            if (durationText) {
              const durationItem = document.createElement('div');
              durationItem.className = 'journey-info-item';
              durationItem.innerHTML = `<div class="journey-info-label">Reisedauer</div><div class="journey-info-value">${durationText}</div>`;
              journeyInfo.appendChild(durationItem);
            }
            
            const changesItem = document.createElement('div');
            changesItem.className = 'journey-info-item';
            changesItem.innerHTML = `<div class="journey-info-label">Umstiege</div><div class="journey-info-value">${changes}</div>`;
            journeyInfo.appendChild(changesItem);
            
            if (msg.route.nodes.length > 0) {
              const stopsItem = document.createElement('div');
              stopsItem.className = 'journey-info-item';
              stopsItem.innerHTML = `<div class="journey-info-label">Halte</div><div class="journey-info-value">${msg.route.nodes.length}</div>`;
              journeyInfo.appendChild(stopsItem);
            }
          }
        }
      }
    } else if (msg.phase === 'segments-start') {
      if (progressEl) progressEl.textContent = `Preise ${msg.total} Segmente...`;
      log(`Pricing ${msg.total} segments (nodes ${msg.totalNodes})…`);
    } else if (msg.phase === 'segment-pricing') {
      log(`Pricing ${msg.fromIdx}→${msg.toIdx} (${msg.fromEva}→${msg.toEva})…`);
    } else if (msg.phase === 'segment-priced') {
      log(`${msg.fromIdx}→${msg.toIdx} ${msg.ok ? 'ok' : 'fail'}` + (msg.error ? ` (${msg.error})` : '') + (msg.attempts > 1 ? ` [${msg.attempts} attempts]` : ''));
    } else if (msg.phase === 'segment-retry') {
      log(`${msg.fromIdx}→${msg.toIdx} retry ${msg.attempt} in ${msg.nextAttemptIn}ms: ${msg.error}`);
    } else if (msg.phase === 'segments-progress') {
      const percent = Math.round(msg.done/msg.total*100);
      if (progressEl) progressEl.textContent = `Segmentpreise: ${msg.done}/${msg.total} (${percent}%)`;
      log(`Progress: ${msg.done}/${msg.total} segments (${percent}%)`);
    } else if (msg.phase === 'segments-done') {
      if (progressEl) progressEl.textContent = 'Berechne beste Aufteilung...';
      log(`Segments done: ${msg.produced}/${msg.total}`);
    } else if (msg.phase === 'dp-start') {
      if (progressEl) progressEl.textContent = `Optimiere aus ${msg.validSegments} verfügbaren Segmenten...`;
      log(`Computing best split from ${msg.validSegments} valid segments…`);
    } else if (msg.phase === 'dp-done' && !msg.error) {
      if (progressEl) progressEl.textContent = `Analyse abgeschlossen: ${msg.segmentsUsed} Segmente, ${msg.totalCost.toFixed(2)} EUR`;
      log(`Best split found: ${msg.segmentsUsed} segments, total ${msg.totalCost.toFixed(2)} EUR`);
    } else if (msg.phase === 'dp-done' && msg.error) {
      if (progressEl) progressEl.textContent = 'Optimierung fehlgeschlagen';
      log(`DP optimization failed: ${msg.error}`);
    }
  });
  if (runBtn) runBtn.addEventListener('click', async () => {
    if (!EXT?.runtime?.sendMessage) {
      if (result) result.textContent = 'API nicht verfügbar.';
      return;
    }
    
    // Reset UI state and disable button
    runBtn.disabled = true;
    runBtn.textContent = 'Analysiere...';
    if (result) result.textContent = 'Analysiere …';
    if (progressEl) progressEl.textContent = 'Starte Analyse...';
    if (progressLog) {
      progressLog.textContent = '';
      progressLog.style.display = 'block'; // Show logs during analysis
    }
    if (progressLogHeader) {
      progressLogHeader.classList.remove('collapsed'); // Expand header
    }
    if (summaryBanner) summaryBanner.style.display = 'none';
    if (segmentsWrap) segmentsWrap.style.display = 'none';
    if (bestWrap) bestWrap.style.display = 'none';
    if (offersWrap) offersWrap.style.display = 'none';
    // Don't hide map if it's already loaded - we want to keep it visible
    // if (mapContainer) mapContainer.style.display = 'none';
    // Don't clear journey info if already present - it's still valid
    // const existingJourneyInfo = document.querySelector('.journey-info');
    // if (existingJourneyInfo) {
    //   existingJourneyInfo.remove();
    // }
    
    // Get current options from form
    const currentOptions = {
      class: classSelect?.value || '2',
      age: parseInt(ageInput?.value || '30', 10),
      bahncard: bahncardSelect?.value || 'none',
      dticket: dticketCheck?.checked || false
    };
    
    try {
      const res = await EXT.runtime.sendMessage({ type: 'start-analysis', token, options: currentOptions });
      if (!res?.ok) {
        if (result) result.textContent = 'Fehler beim Starten der Analyse.' + (res?.error ? `\n${res.error}` : '');
      } else {
        if (result) result.textContent = JSON.stringify(res.summary, null, 2);
        
        // Map and journey info are now shown earlier when route is parsed

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
              
              // Collect train labels for this segment
              const trainLabels = [];
              for (let i = seg.fromIdx; i < seg.toIdx && i < route.nodes.length; i++) {
                const label = route.nodes[i]?.trainLabel;
                if (label && !trainLabels.includes(label)) {
                  trainLabels.push(label);
                }
              }
              
              let segmentText = `${fromName} → ${toName} (${seg.amount.toFixed(2)} ${seg.currency})`;
              if (trainLabels.length > 0) {
                segmentText += ` [${trainLabels.join(', ')}]`;
              }
              segmentTexts.push(segmentText);
            }
            chosenSegmentsList.textContent = segmentTexts.join(' + ');
            chosenSegments.style.display = '';
            if (copySegmentsBtn) copySegmentsBtn.style.display = '';
          } else {
            chosenSegments.style.display = 'none';
            if (copySegmentsBtn) copySegmentsBtn.style.display = 'none';
          }

          summaryBanner.style.display = '';
        } else if (split?.error && ti?.bestOffer) {
          // Show error state in summary banner
          originalPrice.textContent = `${ti.bestOffer.amount.toFixed(2)} ${ti.bestOffer.currency}`;
          bestSplitPrice.textContent = 'Fehler';
          savingsEl.textContent = split.error === 'no-path-found' ? 'Keine vollständige Aufteilung möglich' : `Fehler: ${split.error}`;
          savingsEl.style.color = '#dc3545';
          chosenSegments.style.display = 'none';
          if (copySegmentsBtn) copySegmentsBtn.style.display = 'none';
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
        // Render segments (improved display)
        const segs = res.summary?.segments;
        if (Array.isArray(segs) && segs.length) {
          segmentsUl.innerHTML = '';

          // Filter segments and group by origin station
          const validSegments = segs
            .filter(s => s?.bestOffer?.amount != null);

          if (validSegments.length > 0) {
            // Group segments by origin station with their fromIdx for sorting
            const groupsWithIndex = new Map();
            validSegments.forEach(s => {
              const fromName = s.from?.name || s.from?.eva || '?';
              const fromIdx = s.fromIdx;
              
              if (!groupsWithIndex.has(fromName)) {
                groupsWithIndex.set(fromName, {
                  segments: [],
                  minFromIdx: fromIdx != null ? fromIdx : Infinity
                });
              } else {
                // Update minFromIdx if we find a smaller one
                const group = groupsWithIndex.get(fromName);
                if (fromIdx != null && fromIdx < group.minFromIdx) {
                  group.minFromIdx = fromIdx;
                }
              }
              groupsWithIndex.get(fromName).segments.push(s);
            });

            // Sort groups by their minimum fromIdx (connection order)
            const sortedGroups = Array.from(groupsWithIndex.entries())
              .sort((a, b) => a[1].minFromIdx - b[1].minFromIdx)
              .map(([name, group]) => [name, group.segments]);

            // Create sections for each origin
            let totalShown = 0;
            const maxSegmentsPerOrigin = 5;
            const maxTotalSegments = 15;

            let groupIndex = 0;
            for (const [fromName, segmentGroup] of sortedGroups) {
              if (totalShown >= maxTotalSegments) break;

              // Create collapsible group
              const groupDiv = document.createElement('div');
              groupDiv.className = 'segment-group';
              
              // Add header (all collapsed by default)
              const header = document.createElement('div');
              header.className = 'segment-header collapsed';
              header.innerHTML = `Von ${fromName} <span style="font-weight:normal;color:#666;">(${segmentGroup.length} Verbindungen)</span>`;
              
              // Add content container (all collapsed by default)
              const content = document.createElement('div');
              content.className = 'segment-content collapsed';
              
              // Add segments list
              const ul = document.createElement('ul');
              
              // Sort segments within group by connection order (toIdx), then by price
              const sortedSegmentGroup = segmentGroup.sort((a, b) => {
                // Primary sort: by toIdx (connection order)
                const toIdxDiff = (a.toIdx || 0) - (b.toIdx || 0);
                if (toIdxDiff !== 0) return toIdxDiff;
                // Secondary sort: by price
                return (a.bestOffer?.amount || Infinity) - (b.bestOffer?.amount || Infinity);
              });
              
              // Add segments for this origin (limited)
              const segmentsToShow = sortedSegmentGroup
                .slice(0, Math.min(maxSegmentsPerOrigin, maxTotalSegments - totalShown));

              segmentsToShow.forEach(s => {
                const li = document.createElement('li');
                const to = s.to?.name || s.to?.eva || '?';
                // Add train info if available
                let trainInfo = '';
                if (s.legs && s.legs.length > 0) {
                  const trains = s.legs.map(leg => leg.line?.name || '').filter(Boolean).join(', ');
                  if (trains) trainInfo = ` (${trains})`;
                }
                li.textContent = `→ ${to} – ${s.bestOffer.amount.toFixed(2)} ${s.bestOffer.currency}${trainInfo}`;
                ul.appendChild(li);
                totalShown++;
              });

              // Show how many more segments are available for this origin
              if (segmentGroup.length > segmentsToShow.length) {
                const moreLi = document.createElement('li');
                moreLi.style.cssText = 'font-size: 11px; color: #999; font-style: italic;';
                moreLi.textContent = `… und ${segmentGroup.length - segmentsToShow.length} weitere`;
                ul.appendChild(moreLi);
              }
              
              content.appendChild(ul);
              groupDiv.appendChild(header);
              groupDiv.appendChild(content);
              segmentsUl.appendChild(groupDiv);
              
              // Add click handler for collapse/expand
              header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
              });
              
              groupIndex++;
            }

            // Show total count
            if (validSegments.length > totalShown) {
              const summaryDiv = document.createElement('div');
              summaryDiv.style.cssText = 'margin-top: 12px; padding: 8px; font-size: 12px; color: #666; font-style: italic; text-align: center; background: #f9f9f9; border-radius: 4px;';
              summaryDiv.textContent = `Zeige ${totalShown} von ${validSegments.length} verfügbaren Segmenten (sortiert nach Preis)`;
              segmentsUl.appendChild(summaryDiv);
            }

            segmentsWrap.style.display = '';
          } else {
            segmentsWrap.style.display = 'none';
          }
        } else {
          segmentsWrap.style.display = 'none';
        }
      }
    } catch (e) {
      if (result) result.textContent = 'Unerwarteter Fehler. ' + (e && e.message ? e.message : '');
    } finally {
      // Re-enable button when analysis completes (success or failure)
      runBtn.disabled = false;
      runBtn.textContent = 'Analyse starten';
    }
  });
}

document.addEventListener('DOMContentLoaded', main);
