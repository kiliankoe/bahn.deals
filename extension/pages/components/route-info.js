import { FormatUtils } from "../utils/format-utils.js";

/**
 * Component for displaying route information
 */
export class RouteInfo {
  constructor() {
    this.headerEl = document.querySelector("header");
  }

  /**
   * Display route information
   * @param {Array} nodes - Route nodes
   */
  display(nodes) {
    if (!this.headerEl || !nodes || nodes.length < 2) return;

    // Check if journey info already exists
    if (document.querySelector(".journey-info")) return;

    const journeyInfo = this.createJourneyInfo(nodes);
    if (journeyInfo) {
      this.headerEl.appendChild(journeyInfo);
    }
  }

  /**
   * Create journey info element
   * @param {Array} nodes - Route nodes
   * @returns {HTMLElement|null} Journey info element
   */
  createJourneyInfo(nodes) {
    const duration = this.calculateDuration(nodes);
    const changes = this.countChanges(nodes);

    if (!duration && changes < 0) return null;

    const journeyInfo = document.createElement("div");
    journeyInfo.className = "journey-info";

    if (duration) {
      journeyInfo.appendChild(this.createInfoItem("Reisedauer", duration));
    }

    journeyInfo.appendChild(
      this.createInfoItem("Umstiege", changes.toString()),
    );
    journeyInfo.appendChild(
      this.createInfoItem("Halte", nodes.length.toString()),
    );

    return journeyInfo;
  }

  /**
   * Create info item element
   * @param {string} label - Item label
   * @param {string} value - Item value
   * @returns {HTMLElement} Info item element
   */
  createInfoItem(label, value) {
    const item = document.createElement("div");
    item.className = "journey-info-item";
    item.innerHTML = `
      <div class="journey-info-label">${label}</div>
      <div class="journey-info-value">${value}</div>
    `;
    return item;
  }

  /**
   * Calculate journey duration
   * @param {Array} nodes - Route nodes
   * @returns {string|null} Formatted duration
   */
  calculateDuration(nodes) {
    const startTime = nodes[0]?.departure || nodes[0]?.dep;
    const endTime =
      nodes[nodes.length - 1]?.arrival || nodes[nodes.length - 1]?.arr;

    if (!startTime || !endTime) return null;

    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;

    if (durationMs <= 0) return null;

    const minutes = Math.floor(durationMs / 60000);
    return FormatUtils.formatDuration(minutes);
  }

  /**
   * Count number of changes
   * @param {Array} nodes - Route nodes
   * @returns {number} Number of changes
   */
  countChanges(nodes) {
    let changes = 0;
    let lastTrainLabel = nodes[0]?.trainLabel;

    for (let i = 1; i < nodes.length; i++) {
      const currentLabel = nodes[i]?.trainLabel;
      if (currentLabel && currentLabel !== lastTrainLabel) {
        changes++;
        lastTrainLabel = currentLabel;
      }
    }

    return changes;
  }
}
