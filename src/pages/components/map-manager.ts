import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-leaflet';
import { FormatUtils } from '../utils/format-utils';

export class MapManager {
  private map: L.Map | null = null;
  private routePolyline: L.Polyline | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private containerId = 'map';
  private infoId = 'map-info';

  initialize() {
    if (this.map) return;
    this.map = L.map(this.containerId).setView([51.1657, 10.4515], 6);
    this.addTileLayer();
  }

  private addTileLayer() {
    // Vector tiles via MapLibre if available
    // @ts-ignore added by maplibre-gl-leaflet
    if ((L as any).maplibreGL) {
      try {
        // @ts-ignore
        (L as any)
          .maplibreGL({
            style: 'https://tiles.openfreemap.org/styles/bright',
            attribution: 'Map data © OpenStreetMap contributors',
          })
          .addTo(this.map!);
        return;
      } catch {}
    }
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data © OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map!);
  }

  displayRoute(nodes: any[]) {
    if (!nodes?.length || nodes.length < 2) return;
    this.initialize();
    this.clearRoute();
    const coordinates = nodes
      .filter((n) => n.location?.latitude && n.location?.longitude)
      .map((n) => [n.location.latitude, n.location.longitude]) as [number, number][];
    if (coordinates.length < 2) return this.showInsufficientDataWarning(nodes);
    this.addMarkers(coordinates, nodes);
    this.drawPolyline(coordinates);
    this.updateInfo(nodes, coordinates);
  }

  private clearRoute() {
    if (this.routePolyline) this.map!.removeLayer(this.routePolyline);
    if (this.markersLayer) this.map!.removeLayer(this.markersLayer);
    this.routePolyline = null;
    this.markersLayer = null;
  }

  private addMarkers(coordinates: [number, number][], nodes: any[]) {
    this.markersLayer = L.layerGroup().addTo(this.map!);
    const nodesWithCoords = nodes.filter((n) => n.location?.latitude && n.location?.longitude);
    coordinates.forEach((coord, i) => {
      const node = nodesWithCoords[i];
      const marker = this.createMarker(coord, node, i, coordinates.length);
      marker.addTo(this.markersLayer!);
    });
  }

  private createMarker(coord: [number, number], node: any, index: number, total: number) {
    const letter = String.fromCharCode(65 + index);
    const isStartOrEnd = index === 0 || index === total - 1;
    const isTransferStation = node.name && (node.name.includes('Hbf') || node.name.includes('Hauptbahnhof'));
    const backgroundColor = isStartOrEnd ? '#EC0016' : isTransferStation ? '#EC0016' : '#666';
    const size = isStartOrEnd ? 30 : 24;
    const fontSize = isStartOrEnd ? 16 : 14;
    const icon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style='background-color:${backgroundColor};color:white;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${fontSize}px;'>${letter}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    const popupContent = this.createPopupContent(letter, node);
    return L.marker(coord, { icon }).bindPopup(popupContent);
  }

  private createPopupContent(letter: string, node: any) {
    let content = `<strong>${letter}: ${node.name || 'Station'}</strong><br>`;
    if (node.trainLabel) content += `Zug: ${node.trainLabel}<br>`;
    if (node.arr) content += `Ankunft: ${FormatUtils.formatTime(node.arr)}<br>`;
    if (node.dep) content += `Abfahrt: ${FormatUtils.formatTime(node.dep)}`;
    return content;
  }

  private drawPolyline(coordinates: [number, number][]) {
    this.routePolyline = L.polyline(coordinates, { color: '#EC0016', weight: 4, opacity: 0.8 }).addTo(this.map!);
    this.map!.fitBounds(this.routePolyline.getBounds().pad(0.1));
  }

  private updateInfo(nodes: any[], coordinates: [number, number][]) {
    const mapInfo = document.getElementById(this.infoId);
    if (!mapInfo) return;
    const intermediateStops = nodes.length - 2;
    const distance = Math.round(
      this.routePolyline!.getBounds().getNorthEast().distanceTo(this.routePolyline!.getBounds().getSouthWest()) / 1000,
    );
    let infoText = `Route: ${nodes.length} Stationen `;
    infoText += intermediateStops > 0 ? `(${intermediateStops} Zwischenhalte)` : '(Direktverbindung)';
    infoText += `, ca. ${distance} km Luftlinie`;
    if (coordinates.length < nodes.length) {
      const missingCount = nodes.length - coordinates.length;
      infoText += ` <span style="color:#ff6b00;">⚠ ${missingCount} Station${missingCount > 1 ? 'en' : ''} ohne Koordinaten</span>`;
    }
    mapInfo.innerHTML = infoText;
  }

  private showInsufficientDataWarning(nodes: any[]) {
    const mapInfo = document.getElementById(this.infoId);
    if (!mapInfo) return;
    mapInfo.innerHTML = '<span style="color:#dc3545;">⚠ Nicht genügend Koordinaten verfügbar.</span>';
  }
}
