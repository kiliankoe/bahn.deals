import { FormatUtils } from '../utils/format-utils';

export class ResultsRenderer {
  private elements = {
    result: document.getElementById('result'),
    bestWrap: document.getElementById('best-offer') as HTMLElement | null,
    bestText: document.getElementById('best-offer-text') as HTMLElement | null,
    offersWrap: document.getElementById('offers-list') as HTMLElement | null,
    offersUl: document.getElementById('offers') as HTMLElement | null,
    segmentsWrap: document.getElementById('segments-list') as HTMLElement | null,
    segmentsUl: document.getElementById('segments') as HTMLElement | null,
    summaryBanner: document.getElementById('summary-banner') as HTMLElement | null,
    originalPrice: document.getElementById('original-price') as HTMLElement | null,
    bestSplitPrice: document.getElementById('best-split-price') as HTMLElement | null,
    savingsEl: document.getElementById('savings') as HTMLElement | null,
    chosenSegments: document.getElementById('chosen-segments') as HTMLElement | null,
    chosenSegmentsList: document.getElementById('chosen-segments-list') as HTMLElement | null,
    copySegmentsBtn: document.getElementById('copy-segments') as HTMLButtonElement | null,
  };

  constructor() {
    this.setupCopyButton();
  }

  display(summary: any) {
    if (this.elements.result) this.elements.result.textContent = JSON.stringify(summary, null, 2);
    this.renderSummaryBanner(summary);
    this.renderBestOffer(summary.ticketsInfo);
    this.renderOffersList(summary.ticketsInfo);
    this.renderSegmentsList(summary.segments);
  }

  hide() {
    ['summaryBanner', 'bestWrap', 'offersWrap', 'segmentsWrap'].forEach((key) => {
      const el = (this.elements as any)[key] as HTMLElement | null;
      if (el) el.style.display = 'none';
    });
  }

  private setupCopyButton() {
    if (!this.elements.copySegmentsBtn) return;
    this.elements.copySegmentsBtn.addEventListener('click', async () => {
      const text = this.elements.chosenSegmentsList?.textContent || '';
      const success = await FormatUtils.copyToClipboard(text);
      const originalText = this.elements.copySegmentsBtn!.textContent;
      this.elements.copySegmentsBtn!.textContent = success ? 'Kopiert! ✓' : 'Fehler beim Kopieren';
      setTimeout(() => {
        this.elements.copySegmentsBtn!.textContent = originalText || '';
      }, 2000);
    });
  }

  private renderSummaryBanner(summary: any) {
    const split = summary?.split;
    const ti = summary?.ticketsInfo;
    const route = summary?.route;
    if (!split || !ti?.bestOffer) {
      if (this.elements.summaryBanner) this.elements.summaryBanner.style.display = 'none';
      return;
    }
    if (split.error) return this.renderSplitError(split, ti);
    this.renderSplitSuccess(split, ti, route);
  }

  private renderSplitSuccess(split: any, ti: any, route: any) {
    const originalAmount = ti.bestOffer.amount;
    const splitAmount = split.total;
    const savings = originalAmount - splitAmount;
    const savingsPercent = originalAmount > 0 ? (savings / originalAmount) * 100 : 0;
    if (this.elements.originalPrice) {
      this.elements.originalPrice.textContent = FormatUtils.formatPrice(originalAmount, ti.bestOffer.currency);
      this.elements.originalPrice.style.display = '';
    }
    if (this.elements.bestSplitPrice) {
      this.elements.bestSplitPrice.textContent = FormatUtils.formatPrice(splitAmount, split.currency);
      this.elements.bestSplitPrice.style.display = '';
    }
    if (this.elements.savingsEl) {
      if (savings > 0.01) {
        this.elements.savingsEl.textContent = `${FormatUtils.formatPrice(savings, ti.bestOffer.currency)} (${savingsPercent.toFixed(1)}%)`;
        this.elements.savingsEl.style.color = '#28a745';
      } else if (savings < -0.01) {
        this.elements.savingsEl.textContent = `+${FormatUtils.formatPrice(Math.abs(savings), ti.bestOffer.currency)} (${Math.abs(savingsPercent).toFixed(1)}%)`;
        this.elements.savingsEl.style.color = '#dc3545';
      } else {
        this.elements.savingsEl.textContent = 'Kein Unterschied';
        this.elements.savingsEl.style.color = '#6c757d';
      }
      this.elements.savingsEl.style.display = '';
    }
    this.renderChosenSegments(split.segments, route);
    if (this.elements.summaryBanner) this.elements.summaryBanner.style.display = '';
  }

  private renderSplitError(split: any, ti: any) {
    if (this.elements.originalPrice) this.elements.originalPrice.textContent = FormatUtils.formatPrice(ti.bestOffer.amount, ti.bestOffer.currency);
    if (this.elements.bestSplitPrice) this.elements.bestSplitPrice.textContent = 'Fehler';
    if (this.elements.savingsEl) {
      this.elements.savingsEl.textContent = split.error === 'no-path-found' ? 'Keine vollständige Aufteilung möglich' : `Fehler: ${split.error}`;
      this.elements.savingsEl.style.color = '#dc3545';
    }
    if (this.elements.chosenSegments) this.elements.chosenSegments.style.display = 'none';
    if (this.elements.copySegmentsBtn) this.elements.copySegmentsBtn.style.display = 'none';
    if (this.elements.summaryBanner) this.elements.summaryBanner.style.display = '';
  }

  private renderChosenSegments(segments: any[], route: any) {
    if (!Array.isArray(segments) || !segments.length || !route?.nodes) {
      if (this.elements.chosenSegments) this.elements.chosenSegments.style.display = 'none';
      if (this.elements.copySegmentsBtn) this.elements.copySegmentsBtn.style.display = 'none';
      return;
    }
    const segmentTexts = segments.map((seg) => {
      const fromNode = route.nodes[seg.fromIdx];
      const toNode = route.nodes[seg.toIdx];
      const fromName = fromNode?.name || fromNode?.eva || '?';
      const toName = toNode?.name || toNode?.eva || '?';
      const trainLabels: string[] = [];
      for (let i = seg.fromIdx; i < seg.toIdx && i < route.nodes.length; i++) {
        const label = route.nodes[i]?.trainLabel;
        if (label && !trainLabels.includes(label)) trainLabels.push(label);
      }
      let segmentText = `${fromName} → ${toName} (${FormatUtils.formatPrice(seg.amount, seg.currency)})`;
      if (trainLabels.length > 0) segmentText += ` [${trainLabels.join(', ')}]`;
      return segmentText;
    });
    if (this.elements.chosenSegmentsList) this.elements.chosenSegmentsList.textContent = segmentTexts.join(' + ');
    if (this.elements.chosenSegments) this.elements.chosenSegments.style.display = '';
    if (this.elements.copySegmentsBtn) this.elements.copySegmentsBtn.style.display = '';
  }

  private renderBestOffer(ticketsInfo: any) {
    if (!ticketsInfo?.bestOffer) {
      if (this.elements.bestWrap) this.elements.bestWrap.style.display = 'none';
      return;
    }
    const offer = ticketsInfo.bestOffer;
    if (this.elements.bestText) this.elements.bestText.textContent = `${offer.name} – ${FormatUtils.formatPrice(offer.amount, offer.currency)}`;
    if (this.elements.bestWrap) this.elements.bestWrap.style.display = '';
  }

  private renderOffersList(ticketsInfo: any) {
    if (!ticketsInfo?.offers?.length) {
      if (this.elements.offersWrap) this.elements.offersWrap.style.display = 'none';
      return;
    }
    if (this.elements.offersUl) this.elements.offersUl.innerHTML = '';
    for (const offer of ticketsInfo.offers) {
      const li = document.createElement('li');
      li.textContent = `${offer.name} – ${FormatUtils.formatPrice(offer.amount, offer.currency)}`;
      this.elements.offersUl?.appendChild(li);
    }
    if (this.elements.offersWrap) this.elements.offersWrap.style.display = '';
  }

  private renderSegmentsList(segments: any[]) {
    if (!Array.isArray(segments) || !segments.length) {
      if (this.elements.segmentsWrap) this.elements.segmentsWrap.style.display = 'none';
      return;
    }
    if (this.elements.segmentsUl) this.elements.segmentsUl.innerHTML = '';
    const validSegments = segments.filter((s) => s?.bestOffer?.amount != null);
    if (validSegments.length === 0) {
      if (this.elements.segmentsWrap) this.elements.segmentsWrap.style.display = 'none';
      return;
    }
    const groups = this.groupSegmentsByOrigin(validSegments);
    groups.forEach(([fromName, segmentGroup]) => {
      const groupEl = this.createSegmentGroup(fromName, segmentGroup);
      this.elements.segmentsUl?.appendChild(groupEl);
    });
    if (this.elements.segmentsWrap) this.elements.segmentsWrap.style.display = '';
  }

  private groupSegmentsByOrigin(segments: any[]) {
    const groupsWithIndex = new Map<string, { segments: any[]; minFromIdx: number }>();
    segments.forEach((s) => {
      const fromName = s.from?.name || s.from?.eva || '?';
      const fromIdx = s.fromIdx;
      if (!groupsWithIndex.has(fromName)) {
        groupsWithIndex.set(fromName, { segments: [], minFromIdx: fromIdx != null ? fromIdx : Infinity });
      } else {
        const group = groupsWithIndex.get(fromName)!;
        if (fromIdx != null && fromIdx < group.minFromIdx) group.minFromIdx = fromIdx;
      }
      groupsWithIndex.get(fromName)!.segments.push(s);
    });
    return Array.from(groupsWithIndex.entries())
      .sort((a, b) => a[1].minFromIdx - b[1].minFromIdx)
      .map(([name, group]) => [name, group.segments] as [string, any[]]);
  }

  private createSegmentGroup(fromName: string, segments: any[]) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'segment-group';
    const header = document.createElement('div');
    header.className = 'segment-header collapsed';
    header.innerHTML = `Von ${fromName} <span style="font-weight:normal;color:#666;">(${segments.length} Verbindungen)</span>`;
    const content = document.createElement('div');
    content.className = 'segment-content collapsed';
    const ul = document.createElement('ul');
    const sortedSegments = segments.sort((a, b) => (a.toIdx || 0) - (b.toIdx || 0) || (a.bestOffer?.amount || Infinity) - (b.bestOffer?.amount || Infinity));
    sortedSegments.forEach((s: any) => {
      const li = document.createElement('li');
      const to = s.to?.name || s.to?.eva || '?';
      li.textContent = `→ ${to} – ${FormatUtils.formatPrice(s.bestOffer.amount, s.bestOffer.currency)}`;
      ul.appendChild(li);
    });
    content.appendChild(ul);
    groupDiv.appendChild(header);
    groupDiv.appendChild(content);
    header.addEventListener('click', () => {
      header.classList.toggle('collapsed');
      content.classList.toggle('collapsed');
    });
    return groupDiv;
  }
}

