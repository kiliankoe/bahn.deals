import { FormatUtils } from '../utils/format-utils';

export class RouteInfo {
  private headerEl = document.querySelector('header');

  display(nodes: any[]) {
    if (!this.headerEl || !nodes || nodes.length < 2) return;
    if (document.querySelector('.journey-info')) return;
    const journeyInfo = this.createJourneyInfo(nodes);
    if (journeyInfo) this.headerEl.appendChild(journeyInfo);
  }

  private createJourneyInfo(nodes: any[]) {
    const duration = this.calculateDuration(nodes);
    const changes = this.countChanges(nodes);
    if (!duration && changes < 0) return null;
    const journeyInfo = document.createElement('div');
    journeyInfo.className = 'journey-info';
    if (duration) journeyInfo.appendChild(this.createInfoItem('Reisedauer', duration));
    journeyInfo.appendChild(this.createInfoItem('Umstiege', changes.toString()));
    journeyInfo.appendChild(this.createInfoItem('Halte', nodes.length.toString()));
    return journeyInfo;
  }

  private createInfoItem(label: string, value: string) {
    const item = document.createElement('div');
    item.className = 'journey-info-item';
    item.innerHTML = `<div class="journey-info-label">${label}</div><div class="journey-info-value">${value}</div>`;
    return item;
  }

  private calculateDuration(nodes: any[]) {
    const startTime = nodes[0]?.departure || nodes[0]?.dep;
    const endTime = nodes[nodes.length - 1]?.arrival || nodes[nodes.length - 1]?.arr;
    if (!startTime || !endTime) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    if (durationMs <= 0) return null;
    const minutes = Math.floor(durationMs / 60000);
    return FormatUtils.formatDuration(minutes);
  }

  private countChanges(nodes: any[]) {
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

