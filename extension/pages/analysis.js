function $(id) {
	return document.getElementById(id);
}
const EXT =
	(typeof browser !== "undefined" && browser) ||
	(typeof chrome !== "undefined" && chrome);

let map = null;
let routePolyline = null;
let markersLayer = null;
function initializeMap() {
	if (!map && typeof L !== "undefined") {
		map = L.map("map").setView([51.1657, 10.4515], 6); // Germany center

		// Try vector tiles first if MapLibre GL is available
		if (typeof L.maplibreGL !== "undefined") {
			try {
				L.maplibreGL({
					style: "https://tiles.openfreemap.org/styles/bright",
					attribution:
						'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				}).addTo(map);
			} catch (e) {
				console.warn("MapLibre GL failed, falling back to raster tiles:", e);
				// Fallback to standard OSM raster tiles
				L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
					attribution:
						'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
					maxZoom: 19,
				}).addTo(map);
			}
		} else {
			// Use standard OSM raster tiles if MapLibre GL not available
			L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
				attribution:
					'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 19,
			}).addTo(map);
		}
	}
	return map;
}

function displayRoute(nodes) {
	if (!map || !nodes || nodes.length < 2 || typeof L === "undefined") return;

	if (routePolyline) {
		map.removeLayer(routePolyline);
		routePolyline = null;
	}
	if (markersLayer) {
		map.removeLayer(markersLayer);
		markersLayer = null;
	}

	markersLayer = L.layerGroup().addTo(map);

	// Try both coordinate orders since APIs vary
	const coordinates = nodes
		.filter((n) => n.location?.latitude && n.location?.longitude)
		.map((n) => {
			return [n.location.latitude, n.location.longitude];
		});

	if (coordinates.length < 2) {
		console.warn(
			"Not enough coordinates to display route. Nodes with location:",
			nodes.filter((n) => n.location),
		);
		// Show a warning message
		const mapInfo = $("#map-info");
		if (mapInfo) {
			mapInfo.innerHTML =
				'<span style="color: #dc3545;">⚠ Nicht genügend Koordinaten verfügbar. Bitte versuchen Sie es später erneut.</span>';
		}
		return;
	}

	if (coordinates.length < nodes.length) {
		const missingStations = nodes
			.filter((n) => !n.location)
			.map((n) => n.name)
			.join(", ");
		console.warn(
			`Missing coordinates for ${nodes.length - coordinates.length} stations: ${missingStations}`,
		);
	}

	for (let i = 0; i < coordinates.length; i++) {
		const node = nodes[i];
		const coord = coordinates[i];
		const letter = String.fromCharCode(65 + i); // A, B, C, D...
		const isStartOrEnd = i === 0 || i === coordinates.length - 1;
		const isTransferStation =
			node.name &&
			(node.name.includes("Hbf") || node.name.includes("Hauptbahnhof"));

		L.marker(coord, {
			icon: L.divIcon({
				className: "custom-div-icon",
				html: `<div style='background-color:${isStartOrEnd ? "#EC0016" : isTransferStation ? "#EC0016" : "#666"};color:white;border-radius:50%;width:${isStartOrEnd ? 30 : 24}px;height:${isStartOrEnd ? 30 : 24}px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${isStartOrEnd ? 16 : 14}px;'>${letter}</div>`,
				iconSize: isStartOrEnd ? [30, 30] : [24, 24],
				iconAnchor: isStartOrEnd ? [15, 15] : [12, 12],
			}),
		})
			.addTo(markersLayer)
			.bindPopup(
				`<strong>${letter}: ${node.name || "Station"}</strong><br>` +
					`${node.trainLabel ? `Zug: ${node.trainLabel}<br>` : ""}` +
					`${node.arr ? `Ankunft: ${new Date(node.arr).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}<br>` : ""}` +
					`${node.dep ? `Abfahrt: ${new Date(node.dep).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : ""}`,
			);
	}

	routePolyline = L.polyline(coordinates, {
		color: "#EC0016",
		weight: 4,
		opacity: 0.8,
	}).addTo(map);

	map.fitBounds(routePolyline.getBounds().pad(0.1));

	const mapInfo = $("#map-info");
	if (mapInfo) {
		const intermediateStops = nodes.length - 2;
		const distance = Math.round(
			routePolyline
				.getBounds()
				.getNorthEast()
				.distanceTo(routePolyline.getBounds().getSouthWest()) / 1000,
		);
		let infoText = `Route: ${nodes.length} Stationen (${intermediateStops > 0 ? `${intermediateStops} Zwischenhalte` : "Direktverbindung"}), ca. ${distance} km Luftlinie`;

		if (coordinates.length < nodes.length) {
			const missingCount = nodes.length - coordinates.length;
			infoText += ` <span style="color: #ff6b00;">⚠ ${missingCount} Station${missingCount > 1 ? "en" : ""} ohne Koordinaten</span>`;
		}

		mapInfo.innerHTML = infoText;
	}
}

function formatDuration(minutes) {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}

async function copyToClipboard(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (err) {
		console.error("Failed to copy:", err);
		return false;
	}
}

async function fetchInitialRoute(token) {
	if (!token) return;

	try {
		const res = await EXT.runtime.sendMessage({
			type: "fetch-route-only",
			token,
		});
		if (res?.ok && res.route?.nodes && res.route.nodes.length > 1) {
			const mapContainer = document.getElementById("map-container");
			const progressEl = document.getElementById("progress");

			if (mapContainer) {
				mapContainer.style.display = "";
				setTimeout(() => {
					initializeMap();
					displayRoute(res.route.nodes);
				}, 100);
			}

			const headerEl = document.querySelector("header");
			if (headerEl) {
				// Check both field names for compatibility
				const startTime =
					res.route.nodes[0]?.departure || res.route.nodes[0]?.dep;
				const endTime =
					res.route.nodes[res.route.nodes.length - 1]?.arrival ||
					res.route.nodes[res.route.nodes.length - 1]?.arr;
				let durationText = "";
				if (startTime && endTime) {
					const start = new Date(startTime);
					const end = new Date(endTime);
					const durationMs = end - start;
					if (durationMs > 0) {
						const minutes = Math.floor(durationMs / 60000);
						durationText = formatDuration(minutes);
					}
				}

				let changes = 0;
				if (res.route.nodes && res.route.nodes.length > 0) {
					let lastTrainLabel = res.route.nodes[0]?.trainLabel;
					for (let i = 1; i < res.route.nodes.length; i++) {
						const currentLabel = res.route.nodes[i]?.trainLabel;
						if (currentLabel && currentLabel !== lastTrainLabel) {
							changes++;
							lastTrainLabel = currentLabel;
						}
					}
				}

				let journeyInfo = document.querySelector(".journey-info");
				if (!journeyInfo && (durationText || changes >= 0)) {
					journeyInfo = document.createElement("div");
					journeyInfo.className = "journey-info";
					headerEl.appendChild(journeyInfo);

					if (durationText) {
						const durationItem = document.createElement("div");
						durationItem.className = "journey-info-item";
						durationItem.innerHTML = `<div class="journey-info-label">Reisedauer</div><div class="journey-info-value">${durationText}</div>`;
						journeyInfo.appendChild(durationItem);
					}

					const changesItem = document.createElement("div");
					changesItem.className = "journey-info-item";
					changesItem.innerHTML = `<div class="journey-info-label">Umstiege</div><div class="journey-info-value">${changes}</div>`;
					journeyInfo.appendChild(changesItem);

					if (res.route.nodes.length > 0) {
						const stopsItem = document.createElement("div");
						stopsItem.className = "journey-info-item";
						stopsItem.innerHTML = `<div class="journey-info-label">Halte</div><div class="journey-info-value">${res.route.nodes.length}</div>`;
						journeyInfo.appendChild(stopsItem);
					}
				}
			}

			if (progressEl)
				progressEl.textContent =
					"Verbindungsdaten geladen. Bereit für Analyse.";
		} else {
			if (progressEl)
				progressEl.textContent =
					"Verbindungsdaten erhalten. Analyse in Vorbereitung …";
			console.debug("Could not fetch initial route:", res?.error);
		}
	} catch (e) {
		const progressEl = document.getElementById("progress");
		if (progressEl)
			progressEl.textContent =
				"Verbindungsdaten erhalten. Analyse in Vorbereitung …";
		console.debug("Error fetching initial route:", e);
	}
}

async function main() {
	const params = new URLSearchParams(location.search);
	const token = params.get("token");
	let selection = null;
	if (token) {
		try {
			const res = await EXT.runtime.sendMessage({
				type: "get-analysis-selection",
				token,
			});
			selection = res?.selection || null;
		} catch {}
	}

	const routeEl = $("#route");
	const metaEl = $("#meta");
	const progressEl = $("#progress");
	const detailsEl = $("#details");

	if (!selection) {
		if (routeEl) routeEl.textContent = "bahn.deals – Analyse";
		if (metaEl) metaEl.textContent = "";
		if (progressEl)
			progressEl.textContent = "Keine übergebene Verbindung gefunden.";
		if (detailsEl)
			detailsEl.textContent =
				"Öffnen Sie das Menü einer Verbindung auf bahn.de und wählen Sie „Günstigste Aufteilung suchen“.";
	}

	if (selection) {
		const { fromName, toName, depTime, arrTime, dateTimeParam, lines } =
			selection;
		if (routeEl)
			routeEl.textContent = `${fromName || "Start"} → ${toName || "Ziel"}`;
		if (metaEl)
			metaEl.textContent = `${depTime || "?"} – ${arrTime || "?"}  |  ${dateTimeParam || ""}`;
		if (progressEl)
			progressEl.textContent = "Lade Streckendaten für Kartenanzeige...";
		if (detailsEl)
			detailsEl.textContent = `Verkehrsmittel: ${Array.isArray(lines) && lines.length ? lines.join(", ") : "unbekannt"}`;

		fetchInitialRoute(token);
	}

	const runBtn = document.getElementById("run");
	const result = document.getElementById("result");
	const bestWrap = document.getElementById("best-offer");
	const bestText = document.getElementById("best-offer-text");
	const offersWrap = document.getElementById("offers-list");
	const offersUl = document.getElementById("offers");
	const segmentsWrap = document.getElementById("segments-list");
	const segmentsUl = document.getElementById("segments");
	const progressLog = document.getElementById("progress-log");
	const summaryBanner = document.getElementById("summary-banner");
	const originalPrice = document.getElementById("original-price");
	const bestSplitPrice = document.getElementById("best-split-price");
	const savingsEl = document.getElementById("savings");
	const chosenSegments = document.getElementById("chosen-segments");
	const chosenSegmentsList = document.getElementById("chosen-segments-list");
	const copySegmentsBtn = document.getElementById("copy-segments");
	const progressLogHeader = document.getElementById("progress-log-header");
	const mapContainer = document.getElementById("map-container");

	const classSelect = document.getElementById("class-select");
	const ageInput = document.getElementById("age-input");
	const bahncardSelect = document.getElementById("bahncard-select");
	const dticketCheck = document.getElementById("dticket-check");

	async function loadOptions() {
		try {
			const res = await EXT.runtime.sendMessage({ type: "get-options" });
			if (res?.options) {
				if (classSelect) classSelect.value = res.options.class || "2";
				if (ageInput) ageInput.value = res.options.age || 30;
				if (bahncardSelect)
					bahncardSelect.value = res.options.bahncard || "none";
				if (dticketCheck) dticketCheck.checked = res.options.dticket || false;
			}
		} catch (e) {
			console.error("Failed to load options:", e);
		}
	}

	async function saveOptions() {
		const options = {
			class: classSelect?.value || "2",
			age: parseInt(ageInput?.value || "30", 10),
			bahncard: bahncardSelect?.value || "none",
			dticket: dticketCheck?.checked || false,
		};
		try {
			await EXT.runtime.sendMessage({ type: "set-options", options });
		} catch (e) {
			console.error("Failed to save options:", e);
		}
	}

	if (classSelect) classSelect.addEventListener("change", saveOptions);
	if (ageInput) ageInput.addEventListener("change", saveOptions);
	if (bahncardSelect) bahncardSelect.addEventListener("change", saveOptions);
	if (dticketCheck) dticketCheck.addEventListener("change", saveOptions);

	loadOptions();

	if (progressLogHeader) {
		progressLogHeader.addEventListener("click", () => {
			const isCollapsed = progressLogHeader.classList.contains("collapsed");
			progressLogHeader.classList.toggle("collapsed");
			if (progressLog) {
				progressLog.style.display = isCollapsed ? "block" : "none";
			}
		});
	}

	if (copySegmentsBtn) {
		copySegmentsBtn.addEventListener("click", async () => {
			const text = chosenSegmentsList?.textContent || "";
			const success = await copyToClipboard(text);
			const originalText = copySegmentsBtn.textContent;
			copySegmentsBtn.textContent = success
				? "Kopiert! ✓"
				: "Fehler beim Kopieren";
			setTimeout(() => {
				copySegmentsBtn.textContent = originalText;
			}, 2000);
		});
	}

	const log = (line) => {
		if (!progressLog) return;
		const div = document.createElement("div");
		div.textContent = line;
		progressLog.appendChild(div);
		progressLog.scrollTop = progressLog.scrollHeight;
	};

	EXT.runtime.onMessage.addListener((msg) => {
		if (!msg || msg.type !== "analysis-progress") return;

		if (msg.phase === "init") {
			if (progressEl) progressEl.textContent = "Initialisiere Analyse...";
			log(`Init: EVA ${msg.fromEva} → ${msg.toEva} @ ${msg.depDateTime}`);
		} else if (msg.phase === "journeys-fetched") {
			if (progressEl)
				progressEl.textContent = `${msg.journeysCount} Verbindungen gefunden, analysiere Route...`;
			log(`Found ${msg.journeysCount} journeys`);
		} else if (msg.phase === "route-parsed") {
			if (progressEl)
				progressEl.textContent = `Route analysiert (${msg.nodes} Halte), preise Segmente...`;
			log(`Route parsed: ${msg.nodes} Halte`);

			// Show map and journey info as soon as route is parsed
			if (msg.route?.nodes && msg.route.nodes.length > 1) {
				if (mapContainer && mapContainer.style.display === "none") {
					mapContainer.style.display = "";
					setTimeout(() => {
						initializeMap();
						displayRoute(msg.route.nodes);
					}, 100);
				}

				const headerEl = document.querySelector("header");
				if (headerEl && !document.querySelector(".journey-info")) {
					// Check both field names for compatibility
					const startTime =
						msg.route.nodes[0]?.departure || msg.route.nodes[0]?.dep;
					const endTime =
						msg.route.nodes[msg.route.nodes.length - 1]?.arrival ||
						msg.route.nodes[msg.route.nodes.length - 1]?.arr;
					let durationText = "";
					if (startTime && endTime) {
						const start = new Date(startTime);
						const end = new Date(endTime);
						const durationMs = end - start;
						if (durationMs > 0) {
							const minutes = Math.floor(durationMs / 60000);
							durationText = formatDuration(minutes);
						}
					}

					let changes = 0;
					if (msg.route.nodes && msg.route.nodes.length > 0) {
						let lastTrainLabel = msg.route.nodes[0]?.trainLabel;
						for (let i = 1; i < msg.route.nodes.length; i++) {
							const currentLabel = msg.route.nodes[i]?.trainLabel;
							if (currentLabel && currentLabel !== lastTrainLabel) {
								changes++;
								lastTrainLabel = currentLabel;
							}
						}
					}

					let journeyInfo = document.querySelector(".journey-info");
					if (!journeyInfo && (durationText || changes >= 0)) {
						journeyInfo = document.createElement("div");
						journeyInfo.className = "journey-info";
						headerEl.appendChild(journeyInfo);

						if (durationText) {
							const durationItem = document.createElement("div");
							durationItem.className = "journey-info-item";
							durationItem.innerHTML = `<div class="journey-info-label">Reisedauer</div><div class="journey-info-value">${durationText}</div>`;
							journeyInfo.appendChild(durationItem);
						}

						const changesItem = document.createElement("div");
						changesItem.className = "journey-info-item";
						changesItem.innerHTML = `<div class="journey-info-label">Umstiege</div><div class="journey-info-value">${changes}</div>`;
						journeyInfo.appendChild(changesItem);

						if (msg.route.nodes.length > 0) {
							const stopsItem = document.createElement("div");
							stopsItem.className = "journey-info-item";
							stopsItem.innerHTML = `<div class="journey-info-label">Halte</div><div class="journey-info-value">${msg.route.nodes.length}</div>`;
							journeyInfo.appendChild(stopsItem);
						}
					}
				}
			}
		} else if (msg.phase === "segments-start") {
			if (progressEl)
				progressEl.textContent = `Preise ${msg.total} Segmente...`;
			log(`Pricing ${msg.total} segments (nodes ${msg.totalNodes})…`);
		} else if (msg.phase === "segment-pricing") {
			log(`Pricing ${msg.fromIdx}→${msg.toIdx} (${msg.fromEva}→${msg.toEva})…`);
		} else if (msg.phase === "segment-priced") {
			log(
				`${msg.fromIdx}→${msg.toIdx} ${msg.ok ? "ok" : "fail"}` +
					(msg.error ? ` (${msg.error})` : "") +
					(msg.attempts > 1 ? ` [${msg.attempts} attempts]` : ""),
			);
		} else if (msg.phase === "segment-retry") {
			log(
				`${msg.fromIdx}→${msg.toIdx} retry ${msg.attempt} in ${msg.nextAttemptIn}ms: ${msg.error}`,
			);
		} else if (msg.phase === "segments-progress") {
			const percent = Math.round((msg.done / msg.total) * 100);
			if (progressEl)
				progressEl.textContent = `Segmentpreise: ${msg.done}/${msg.total} (${percent}%)`;
			log(`Progress: ${msg.done}/${msg.total} segments (${percent}%)`);
		} else if (msg.phase === "segments-done") {
			if (progressEl) progressEl.textContent = "Berechne beste Aufteilung...";
			log(`Segments done: ${msg.produced}/${msg.total}`);
		} else if (msg.phase === "dp-start") {
			if (progressEl)
				progressEl.textContent = `Optimiere aus ${msg.validSegments} verfügbaren Segmenten...`;
			log(`Computing best split from ${msg.validSegments} valid segments…`);
		} else if (msg.phase === "dp-done" && !msg.error) {
			if (progressEl)
				progressEl.textContent = `Analyse abgeschlossen: ${msg.segmentsUsed} Segmente, ${msg.totalCost.toFixed(2)} EUR`;
			log(
				`Best split found: ${msg.segmentsUsed} segments, total ${msg.totalCost.toFixed(2)} EUR`,
			);
		} else if (msg.phase === "dp-done" && msg.error) {
			if (progressEl) progressEl.textContent = "Optimierung fehlgeschlagen";
			log(`DP optimization failed: ${msg.error}`);
		}
	});
	if (runBtn) runBtn.addEventListener('click', async () => {
    if (!EXT?.runtime?.sendMessage) {
      if (result) result.textContent = 'API nicht verfügbar.';
      return;
    }

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

        // Map and journey info shown when route is parsed

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

          if (Array.isArray(split.segments) && split.segments.length && route?.nodes) {
            const segmentTexts = [];
            for (const seg of split.segments) {
              const fromNode = route.nodes[seg.fromIdx];
              const toNode = route.nodes[seg.toIdx];
              const fromName = fromNode?.name || fromNode?.eva || '?';
              const toName = toNode?.name || toNode?.eva || '?';

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
        const segs = res.summary?.segments;
        if (Array.isArray(segs) && segs.length) {
          segmentsUl.innerHTML = '';

          const validSegments = segs
            .filter(s => s?.bestOffer?.amount != null);

          if (validSegments.length > 0) {
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
                const group = groupsWithIndex.get(fromName);
                if (fromIdx != null && fromIdx < group.minFromIdx) {
                  group.minFromIdx = fromIdx;
                }
              }
              groupsWithIndex.get(fromName).segments.push(s);
            });

            const sortedGroups = Array.from(groupsWithIndex.entries())
              .sort((a, b) => a[1].minFromIdx - b[1].minFromIdx)
              .map(([name, group]) => [name, group.segments]);

            for (const [fromName, segmentGroup] of sortedGroups) {
              const groupDiv = document.createElement('div');
              groupDiv.className = 'segment-group';

              const header = document.createElement('div');
              header.className = 'segment-header collapsed';
              header.innerHTML = `Von ${fromName} <span style="font-weight:normal;color:#666;">(${segmentGroup.length} Verbindungen)</span>`;

              const content = document.createElement('div');
              content.className = 'segment-content collapsed';

              const ul = document.createElement('ul');

              const sortedSegmentGroup = segmentGroup.sort((a, b) => {
                const toIdxDiff = (a.toIdx || 0) - (b.toIdx || 0);
                if (toIdxDiff !== 0) return toIdxDiff;
                return (a.bestOffer?.amount || Infinity) - (b.bestOffer?.amount || Infinity);
              });

              sortedSegmentGroup.forEach(s => {
                const li = document.createElement('li');
                const to = s.to?.name || s.to?.eva || '?';
                let trainInfo = '';
                if (s.legs && s.legs.length > 0) {
                  const trains = s.legs.map(leg => leg.line?.name || '').filter(Boolean).join(', ');
                  if (trains) trainInfo = ` (${trains})`;
                }
                li.textContent = `→ ${to} – ${s.bestOffer.amount.toFixed(2)} ${s.bestOffer.currency}${trainInfo}`;
                ul.appendChild(li);
              });

              content.appendChild(ul);
              groupDiv.appendChild(header);
              groupDiv.appendChild(content);
              segmentsUl.appendChild(groupDiv);

              header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
              });
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
      runBtn.disabled = false;
      runBtn.textContent = "Analyse starten";
    }
  });
}

document.addEventListener('DOMContentLoaded', main);
