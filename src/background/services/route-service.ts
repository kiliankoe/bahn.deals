import { dbnavJourneys, dbnavLocations, dbnavRefreshTickets } from '../adapters/dbnav';
import { DateUtils } from '../utils/date-utils';
import { CoordinateUtils } from '../utils/coordinate-utils';

export class RouteService {
  async fetchRoute(token: string, sessionService: any, optionsService: any) {
    const entry = sessionService.getSession(token);
    if (!entry.selection) return { ok: false, error: 'no-session' } as const;

    try {
      const selection = entry.selection;
      const depDateTime = DateUtils.parseDateTime(selection);
      const { fromEva, toEva } = await this.resolveStations(selection);
      if (!fromEva || !toEva) return { ok: false, error: 'resolve-failed' } as const;

      const { options } = await optionsService.getOptions();
      const j = await dbnavJourneys({ fromEva, toEva, depDateTime, opts: options });
      const journeys = Array.isArray(j?.verbindungen) ? j.verbindungen : [];
      const first = journeys[0]?.verbindung || null;
      if (!first?.kontext) return { ok: false, error: 'no-journey-found' } as const;

      const recon = await dbnavRefreshTickets({ refreshToken: first.kontext, opts: options });
      const route = await this.parseRoute(recon);
      return { ok: true, route } as const;
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) } as const;
    }
  }

  async resolveStations(selection: any) {
    let fromEva = selection.fromEVA || null;
    let toEva = selection.toEVA || null;
    if (!fromEva && selection.fromName) {
      const res = await dbnavLocations(selection.fromName, 5);
      fromEva = res?.[0]?.evaNr || null;
    }
    if (!toEva && selection.toName) {
      const res = await dbnavLocations(selection.toName, 5);
      toEva = res?.[0]?.evaNr || null;
    }
    return { fromEva, toEva };
  }

  async parseRoute(recon: any) {
    const nodes: any[] = [];
    const abschnitte = recon?.verbindung?.verbindungsAbschnitte || [];
    console.log('Parsing route with', abschnitte.length, 'sections');
    for (let ai = 0; ai < abschnitte.length; ai++) {
      const section = abschnitte[ai];
      const halts = Array.isArray(section?.halte) ? section.halte : [];
      console.log(`Section ${ai}: ${section?.typ}, ${halts.length} halts`);
      for (let hi = 0; hi < halts.length; hi++) {
        const halt = halts[hi];
        const node = this.extractNode(halt, section, ai);
        if (!node) continue;
        const last = nodes[nodes.length - 1];
        if (!last || last.eva !== node.eva) nodes.push(node);
        else {
          if (node.dep) last.dep = node.dep;
          if (node.arr) last.arr = node.arr;
          if (node.location && !last.location) last.location = node.location;
          if (!last.trainLabel && node.trainLabel) last.trainLabel = node.trainLabel;
        }
      }
    }
    console.log('Final route has', nodes.length, 'nodes');
    // Coordinates enrichment is optional here; can be done lazily on the UI side.
    return { nodes };
  }

  private extractNode(halt: any, section: any, secIndex: number) {
    const eva = CoordinateUtils.extractEva(halt);
    if (!eva) {
      console.log('No EVA found for halt:', halt);
      return null;
    }
    const trainLabel = section?.typ === 'FAHRZEUG' ? this.extractTrainLabel(section) : null;
    const location = CoordinateUtils.extractLocation(halt.ort);
    if (!location && halt.ort) {
      console.log('Could not extract location from:', halt.ort);
    }
    return {
      eva,
      name: halt.ort?.name || null,
      dep: halt.abgangsDatum || null,
      arr: halt.ankunftsDatum || null,
      location,
      secIndex,
      trainLabel,
    };
  }

  private extractTrainLabel(section: any) {
    return (
      (section.mitteltext || section.langtext || section.kurztext || section.risZuglaufId || section.zuglaufId || '')
        .trim() || null
    );
  }
}

