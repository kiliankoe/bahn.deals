import { FormatUtils } from "../utils/format-utils.js";

/**
 * Component for managing the route map
 */
export class MapManager {
  constructor() {
    this.map = null;
    this.routePolyline = null;
    this.markersLayer = null;
    this.containerId = "map";
    this.infoId = "map-info";
  }

  /**
   * Initialize the map
   */
  initialize() {
    if (this.map || typeof L === "undefined") return;

    this.map = L.map(this.containerId).setView([51.1657, 10.4515], 6);
    this.addTileLayer();
  }

  /**
   * Add tile layer to map
   */
  addTileLayer() {
    // Try vector tiles first if MapLibre GL is available
    if (typeof L.maplibreGL !== "undefined") {
      try {
        L.maplibreGL({
          style: "https://tiles.openfreemap.org/styles/bright",
          attribution:
            'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(this.map);
        return;
      } catch (e) {
        console.warn("MapLibre GL failed, falling back to raster tiles:", e);
      }
    }

    // Fallback to standard OSM raster tiles
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);
  }

  /**
   * Display route on map
   * @param {Array} nodes - Route nodes
   */
  displayRoute(nodes) {
    if (!nodes?.length || nodes.length < 2) return;

    this.initialize();
    this.clearRoute();

    const coordinates = this.extractCoordinates(nodes);
    if (coordinates.length < 2) {
      this.showInsufficientDataWarning(nodes);
      return;
    }

    this.addMarkers(coordinates, nodes);
    this.drawPolyline(coordinates);
    this.updateInfo(nodes, coordinates);
  }

  /**
   * Clear existing route from map
   */
  clearRoute() {
    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }
    if (this.markersLayer) {
      this.map.removeLayer(this.markersLayer);
      this.markersLayer = null;
    }
  }

  /**
   * Extract coordinates from nodes
   * @param {Array} nodes - Route nodes
   * @returns {Array} Coordinates array
   */
  extractCoordinates(nodes) {
    return nodes
      .filter((n) => n.location?.latitude && n.location?.longitude)
      .map((n) => [n.location.latitude, n.location.longitude]);
  }

  /**
   * Add markers to map
   * @param {Array} coordinates - Coordinate pairs
   * @param {Array} nodes - Original nodes
   */
  addMarkers(coordinates, nodes) {
    this.markersLayer = L.layerGroup().addTo(this.map);

    // Map coordinates back to their nodes
    const nodesWithCoords = nodes.filter(
      (n) => n.location?.latitude && n.location?.longitude,
    );

    coordinates.forEach((coord, i) => {
      const node = nodesWithCoords[i];
      const marker = this.createMarker(coord, node, i, coordinates.length);
      marker.addTo(this.markersLayer);
    });
  }

  /**
   * Create a marker
   * @param {Array} coord - [lat, lng]
   * @param {Object} node - Node data
   * @param {number} index - Node index
   * @param {number} total - Total nodes
   * @returns {L.Marker} Marker
   */
  createMarker(coord, node, index, total) {
    const letter = String.fromCharCode(65 + index); // A, B, C, D...
    const isStartOrEnd = index === 0 || index === total - 1;
    const isTransferStation =
      node.name &&
      (node.name.includes("Hbf") || node.name.includes("Hauptbahnhof"));

    const backgroundColor = isStartOrEnd
      ? "#EC0016"
      : isTransferStation
        ? "#EC0016"
        : "#666";
    const size = isStartOrEnd ? 30 : 24;
    const fontSize = isStartOrEnd ? 16 : 14;

    const icon = L.divIcon({
      className: "custom-div-icon",
      html: `<div style='background-color:${backgroundColor};color:white;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${fontSize}px;'>${letter}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const popupContent = this.createPopupContent(letter, node);

    return L.marker(coord, { icon }).bindPopup(popupContent);
  }

  /**
   * Create popup content for marker
   * @param {string} letter - Station letter
   * @param {Object} node - Node data
   * @returns {string} HTML content
   */
  createPopupContent(letter, node) {
    let content = `<strong>${letter}: ${node.name || "Station"}</strong><br>`;

    if (node.trainLabel) {
      content += `Zug: ${node.trainLabel}<br>`;
    }

    if (node.arr) {
      content += `Ankunft: ${FormatUtils.formatTime(node.arr)}<br>`;
    }

    if (node.dep) {
      content += `Abfahrt: ${FormatUtils.formatTime(node.dep)}`;
    }

    return content;
  }

  /**
   * Draw polyline on map
   * @param {Array} coordinates - Coordinate pairs
   */
  drawPolyline(coordinates) {
    this.routePolyline = L.polyline(coordinates, {
      color: "#EC0016",
      weight: 4,
      opacity: 0.8,
    }).addTo(this.map);

    this.map.fitBounds(this.routePolyline.getBounds().pad(0.1));
  }

  /**
   * Update map info display
   * @param {Array} nodes - All nodes
   * @param {Array} coordinates - Displayed coordinates
   */
  updateInfo(nodes, coordinates) {
    const mapInfo = document.getElementById(this.infoId);
    if (!mapInfo) return;

    const intermediateStops = nodes.length - 2;
    const distance = Math.round(
      this.routePolyline
        .getBounds()
        .getNorthEast()
        .distanceTo(this.routePolyline.getBounds().getSouthWest()) / 1000,
    );

    let infoText = `Route: ${nodes.length} Stationen `;
    infoText +=
      intermediateStops > 0
        ? `(${intermediateStops} Zwischenhalte)`
        : "(Direktverbindung)";
    infoText += `, ca. ${distance} km Luftlinie`;

    if (coordinates.length < nodes.length) {
      const missingCount = nodes.length - coordinates.length;
      infoText += ` <span style="color: #ff6b00;">⚠ ${missingCount} Station${missingCount > 1 ? "en" : ""} ohne Koordinaten</span>`;
    }

    mapInfo.innerHTML = infoText;
  }

  /**
   * Show warning about insufficient data
   * @param {Array} nodes - Route nodes
   */
  showInsufficientDataWarning(nodes) {
    const mapInfo = document.getElementById(this.infoId);
    if (!mapInfo) return;

    const nodesWithLocation = nodes.filter((n) => n.location);
    console.warn(
      "Not enough coordinates to display route. Nodes with location:",
      nodesWithLocation,
    );

    mapInfo.innerHTML =
      '<span style="color: #dc3545;">⚠ Nicht genügend Koordinaten verfügbar. Bitte versuchen Sie es später erneut.</span>';
  }
}
