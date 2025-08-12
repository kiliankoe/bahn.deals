import { FormatUtils } from "../utils/format-utils.js";

/**
 * Component for rendering analysis results
 */
export class ResultsRenderer {
  constructor() {
    this.elements = {
      result: document.getElementById("result"),
      bestWrap: document.getElementById("best-offer"),
      bestText: document.getElementById("best-offer-text"),
      offersWrap: document.getElementById("offers-list"),
      offersUl: document.getElementById("offers"),
      segmentsWrap: document.getElementById("segments-list"),
      segmentsUl: document.getElementById("segments"),
      summaryBanner: document.getElementById("summary-banner"),
      originalPrice: document.getElementById("original-price"),
      bestSplitPrice: document.getElementById("best-split-price"),
      savingsEl: document.getElementById("savings"),
      chosenSegments: document.getElementById("chosen-segments"),
      chosenSegmentsList: document.getElementById("chosen-segments-list"),
      copySegmentsBtn: document.getElementById("copy-segments"),
    };

    this.setupCopyButton();
  }

  /**
   * Display analysis results
   * @param {Object} summary - Analysis summary
   */
  display(summary) {
    if (this.elements.result) {
      this.elements.result.textContent = JSON.stringify(summary, null, 2);
    }

    this.renderSummaryBanner(summary);
    this.renderBestOffer(summary.ticketsInfo);
    this.renderOffersList(summary.ticketsInfo);
    this.renderSegmentsList(summary.segments);
  }

  /**
   * Hide all results
   */
  hide() {
    // Only hide the main containers, not individual elements
    const containersToHide = [
      'summaryBanner',
      'bestWrap',
      'offersWrap',
      'segmentsWrap'
    ];
    
    containersToHide.forEach(key => {
      if (this.elements[key]) {
        this.elements[key].style.display = "none";
      }
    });
  }

  /**
   * Setup copy button
   */
  setupCopyButton() {
    if (!this.elements.copySegmentsBtn) return;

    this.elements.copySegmentsBtn.addEventListener("click", async () => {
      const text = this.elements.chosenSegmentsList?.textContent || "";
      const success = await FormatUtils.copyToClipboard(text);
      const originalText = this.elements.copySegmentsBtn.textContent;

      this.elements.copySegmentsBtn.textContent = success
        ? "Kopiert! ✓"
        : "Fehler beim Kopieren";

      setTimeout(() => {
        this.elements.copySegmentsBtn.textContent = originalText;
      }, 2000);
    });
  }

  /**
   * Render summary banner
   * @param {Object} summary - Analysis summary
   */
  renderSummaryBanner(summary) {
    const split = summary?.split;
    const ti = summary?.ticketsInfo;
    const route = summary?.route;

    if (!split || !ti?.bestOffer) {
      if (this.elements.summaryBanner) {
        this.elements.summaryBanner.style.display = "none";
      }
      return;
    }

    if (split.error) {
      this.renderSplitError(split, ti);
      return;
    }

    this.renderSplitSuccess(split, ti, route);
  }

  /**
   * Render successful split
   * @param {Object} split - Split result
   * @param {Object} ti - Tickets info
   * @param {Object} route - Route data
   */
  renderSplitSuccess(split, ti, route) {
    const originalAmount = ti.bestOffer.amount;
    const splitAmount = split.total;
    const savings = originalAmount - splitAmount;
    const savingsPercent =
      originalAmount > 0 ? (savings / originalAmount) * 100 : 0;

    if (this.elements.originalPrice) {
      this.elements.originalPrice.textContent = FormatUtils.formatPrice(
        originalAmount,
        ti.bestOffer.currency,
      );
      this.elements.originalPrice.style.display = "";
    }
    
    if (this.elements.bestSplitPrice) {
      this.elements.bestSplitPrice.textContent = FormatUtils.formatPrice(
        splitAmount,
        split.currency,
      );
      this.elements.bestSplitPrice.style.display = "";
    }

    // Style savings based on value
    if (this.elements.savingsEl) {
      if (savings > 0.01) {
        this.elements.savingsEl.textContent = `${FormatUtils.formatPrice(savings, ti.bestOffer.currency)} (${savingsPercent.toFixed(1)}%)`;
        this.elements.savingsEl.style.color = "#28a745";
      } else if (savings < -0.01) {
        this.elements.savingsEl.textContent = `+${FormatUtils.formatPrice(Math.abs(savings), ti.bestOffer.currency)} (${Math.abs(savingsPercent).toFixed(1)}%)`;
        this.elements.savingsEl.style.color = "#dc3545";
      } else {
        this.elements.savingsEl.textContent = "Kein Unterschied";
        this.elements.savingsEl.style.color = "#6c757d";
      }
      this.elements.savingsEl.style.display = "";
    }

    // Show chosen segments
    this.renderChosenSegments(split.segments, route);

    if (this.elements.summaryBanner) {
      this.elements.summaryBanner.style.display = "";
    }
  }

  /**
   * Render split error
   * @param {Object} split - Split result with error
   * @param {Object} ti - Tickets info
   */
  renderSplitError(split, ti) {
    this.elements.originalPrice.textContent = FormatUtils.formatPrice(
      ti.bestOffer.amount,
      ti.bestOffer.currency,
    );
    this.elements.bestSplitPrice.textContent = "Fehler";
    this.elements.savingsEl.textContent =
      split.error === "no-path-found"
        ? "Keine vollständige Aufteilung möglich"
        : `Fehler: ${split.error}`;
    this.elements.savingsEl.style.color = "#dc3545";

    this.elements.chosenSegments.style.display = "none";
    if (this.elements.copySegmentsBtn) {
      this.elements.copySegmentsBtn.style.display = "none";
    }

    this.elements.summaryBanner.style.display = "";
  }

  /**
   * Render chosen segments
   * @param {Array} segments - Chosen segments
   * @param {Object} route - Route data
   */
  renderChosenSegments(segments, route) {
    if (!Array.isArray(segments) || !segments.length || !route?.nodes) {
      this.elements.chosenSegments.style.display = "none";
      if (this.elements.copySegmentsBtn) {
        this.elements.copySegmentsBtn.style.display = "none";
      }
      return;
    }

    const segmentTexts = segments.map((seg) => {
      const fromNode = route.nodes[seg.fromIdx];
      const toNode = route.nodes[seg.toIdx];
      const fromName = fromNode?.name || fromNode?.eva || "?";
      const toName = toNode?.name || toNode?.eva || "?";

      // Collect train labels for this segment
      const trainLabels = [];
      for (let i = seg.fromIdx; i < seg.toIdx && i < route.nodes.length; i++) {
        const label = route.nodes[i]?.trainLabel;
        if (label && !trainLabels.includes(label)) {
          trainLabels.push(label);
        }
      }

      let segmentText = `${fromName} → ${toName} (${FormatUtils.formatPrice(seg.amount, seg.currency)})`;
      if (trainLabels.length > 0) {
        segmentText += ` [${trainLabels.join(", ")}]`;
      }

      return segmentText;
    });

    this.elements.chosenSegmentsList.textContent = segmentTexts.join(" + ");
    this.elements.chosenSegments.style.display = "";
    if (this.elements.copySegmentsBtn) {
      this.elements.copySegmentsBtn.style.display = "";
    }
  }

  /**
   * Render best offer
   * @param {Object} ticketsInfo - Tickets info
   */
  renderBestOffer(ticketsInfo) {
    if (!ticketsInfo?.bestOffer) {
      this.elements.bestWrap.style.display = "none";
      return;
    }

    const offer = ticketsInfo.bestOffer;
    this.elements.bestText.textContent = `${offer.name} – ${FormatUtils.formatPrice(offer.amount, offer.currency)}`;
    this.elements.bestWrap.style.display = "";
  }

  /**
   * Render offers list
   * @param {Object} ticketsInfo - Tickets info
   */
  renderOffersList(ticketsInfo) {
    if (!ticketsInfo?.offers?.length) {
      this.elements.offersWrap.style.display = "none";
      return;
    }

    this.elements.offersUl.innerHTML = "";

    for (const offer of ticketsInfo.offers) {
      const li = document.createElement("li");
      li.textContent = `${offer.name} – ${FormatUtils.formatPrice(offer.amount, offer.currency)}`;
      this.elements.offersUl.appendChild(li);
    }

    this.elements.offersWrap.style.display = "";
  }

  /**
   * Render segments list
   * @param {Array} segments - All segments
   */
  renderSegmentsList(segments) {
    if (!Array.isArray(segments) || !segments.length) {
      this.elements.segmentsWrap.style.display = "none";
      return;
    }

    this.elements.segmentsUl.innerHTML = "";

    const validSegments = segments.filter((s) => s?.bestOffer?.amount != null);
    if (validSegments.length === 0) {
      this.elements.segmentsWrap.style.display = "none";
      return;
    }

    // Group segments by origin
    const groups = this.groupSegmentsByOrigin(validSegments);

    // Render each group
    groups.forEach(([fromName, segmentGroup]) => {
      const groupEl = this.createSegmentGroup(fromName, segmentGroup);
      this.elements.segmentsUl.appendChild(groupEl);
    });

    this.elements.segmentsWrap.style.display = "";
  }

  /**
   * Group segments by origin station
   * @param {Array} segments - Valid segments
   * @returns {Array} Grouped segments
   */
  groupSegmentsByOrigin(segments) {
    const groupsWithIndex = new Map();

    segments.forEach((s) => {
      const fromName = s.from?.name || s.from?.eva || "?";
      const fromIdx = s.fromIdx;

      if (!groupsWithIndex.has(fromName)) {
        groupsWithIndex.set(fromName, {
          segments: [],
          minFromIdx: fromIdx != null ? fromIdx : Infinity,
        });
      } else {
        const group = groupsWithIndex.get(fromName);
        if (fromIdx != null && fromIdx < group.minFromIdx) {
          group.minFromIdx = fromIdx;
        }
      }

      groupsWithIndex.get(fromName).segments.push(s);
    });

    // Sort groups by index and extract segments
    return Array.from(groupsWithIndex.entries())
      .sort((a, b) => a[1].minFromIdx - b[1].minFromIdx)
      .map(([name, group]) => [name, group.segments]);
  }

  /**
   * Create segment group element
   * @param {string} fromName - Origin station name
   * @param {Array} segments - Segments from this origin
   * @returns {HTMLElement} Group element
   */
  createSegmentGroup(fromName, segments) {
    const groupDiv = document.createElement("div");
    groupDiv.className = "segment-group";

    const header = document.createElement("div");
    header.className = "segment-header collapsed";
    header.innerHTML = `Von ${fromName} <span style="font-weight:normal;color:#666;">(${segments.length} Verbindungen)</span>`;

    const content = document.createElement("div");
    content.className = "segment-content collapsed";

    const ul = document.createElement("ul");

    // Sort segments by destination index and price
    const sortedSegments = segments.sort((a, b) => {
      const toIdxDiff = (a.toIdx || 0) - (b.toIdx || 0);
      if (toIdxDiff !== 0) return toIdxDiff;
      return (
        (a.bestOffer?.amount || Infinity) - (b.bestOffer?.amount || Infinity)
      );
    });

    sortedSegments.forEach((s) => {
      const li = document.createElement("li");
      const to = s.to?.name || s.to?.eva || "?";
      let trainInfo = "";

      if (s.legs && s.legs.length > 0) {
        const trains = s.legs
          .map((leg) => leg.line?.name || "")
          .filter(Boolean)
          .join(", ");
        if (trains) trainInfo = ` (${trains})`;
      }

      li.textContent = `→ ${to} – ${FormatUtils.formatPrice(s.bestOffer.amount, s.bestOffer.currency)}${trainInfo}`;
      ul.appendChild(li);
    });

    content.appendChild(ul);
    groupDiv.appendChild(header);
    groupDiv.appendChild(content);

    // Make header clickable
    header.addEventListener("click", () => {
      header.classList.toggle("collapsed");
      content.classList.toggle("collapsed");
    });

    return groupDiv;
  }
}
