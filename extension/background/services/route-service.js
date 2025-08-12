import { DateUtils } from "../utils/date-utils.js";
import { CoordinateUtils } from "../utils/coordinate-utils.js";

/**
 * Service for fetching and parsing routes
 */
export class RouteService {
  /**
   * Fetch route for analysis session
   * @param {string} token - Session token
   * @param {SessionService} sessionService - Session service instance
   * @param {OptionsService} optionsService - Options service instance
   * @returns {Object} Route data or error
   */
  async fetchRoute(token, sessionService, optionsService) {
    const entry = sessionService.getSession(token);
    if (!entry.selection) return { ok: false, error: "no-session" };

    try {
      const selection = entry.selection;
      const depDateTime = DateUtils.parseDateTime(selection);
      const { fromEva, toEva } = await this.resolveStations(selection);

      if (!fromEva || !toEva) {
        return { ok: false, error: "resolve-failed" };
      }

      const { options } = await optionsService.getOptions();
      const j = await self.DBNavLite.dbnavJourneys({
        fromEva,
        toEva,
        depDateTime,
        opts: options,
      });

      const journeys = Array.isArray(j?.verbindungen) ? j.verbindungen : [];
      const first = journeys[0]?.verbindung || null;

      if (!first?.kontext) {
        return { ok: false, error: "no-journey-found" };
      }

      const recon = await self.DBNavLite.dbnavRefreshTickets({
        refreshToken: first.kontext,
        opts: options,
      });

      const route = await this.parseRoute(recon);
      return { ok: true, route };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  /**
   * Resolve station EVA numbers from names
   * @param {Object} selection - Selection data
   * @returns {Object} From and to EVA numbers
   */
  async resolveStations(selection) {
    let fromEva = selection.fromEVA || null;
    let toEva = selection.toEVA || null;

    if (!fromEva && selection.fromName) {
      const res = await self.DBNavLite.dbnavLocations(selection.fromName, 5);
      fromEva = res?.[0]?.evaNr || null;
    }

    if (!toEva && selection.toName) {
      const res = await self.DBNavLite.dbnavLocations(selection.toName, 5);
      toEva = res?.[0]?.evaNr || null;
    }

    return { fromEva, toEva };
  }

  /**
   * Parse route from journey data
   * @param {Object} recon - Refreshed journey data
   * @returns {Object} Parsed route with nodes
   */
  async parseRoute(recon) {
    const nodes = [];
    const abschnitte = recon?.verbindung?.verbindungsAbschnitte || [];

    for (let ai = 0; ai < abschnitte.length; ai++) {
      const section = abschnitte[ai];
      const halts = Array.isArray(section?.halte) ? section.halte : [];

      for (let hi = 0; hi < halts.length; hi++) {
        const halt = halts[hi];
        const node = this.extractNode(halt, section, ai);
        if (!node) continue;

        const last = nodes.at(-1);
        if (!last || last.eva !== node.eva) {
          nodes.push(node);
        } else {
          // Merge times if same EVA repeats
          if (node.dep) last.dep = node.dep;
          if (node.arr) last.arr = node.arr;
          if (node.location && !last.location) last.location = node.location;
          if (!last.trainLabel && node.trainLabel)
            last.trainLabel = node.trainLabel;
        }
      }
    }

    // Enrich nodes with coordinates
    await CoordinateUtils.enrichNodesWithCoordinates(nodes);

    return { nodes };
  }

  /**
   * Extract node data from halt
   * @param {Object} halt - Halt data
   * @param {Object} section - Section data
   * @param {number} secIndex - Section index
   * @returns {Object|null} Node data
   */
  extractNode(halt, section, secIndex) {
    const eva = CoordinateUtils.extractEva(halt);
    if (!eva) return null;

    const trainLabel =
      section.typ === "FAHRZEUG" ? this.extractTrainLabel(section) : null;

    return {
      eva,
      name: halt.ort?.name || null,
      dep: halt.abgangsDatum || null,
      arr: halt.ankunftsDatum || null,
      location: CoordinateUtils.extractLocation(halt.ort),
      secIndex,
      trainLabel,
    };
  }

  /**
   * Extract train label from section
   * @param {Object} section - Section data
   * @returns {string|null} Train label
   */
  extractTrainLabel(section) {
    return (
      (
        section.mitteltext ||
        section.langtext ||
        section.kurztext ||
        section.risZuglaufId ||
        section.zuglaufId ||
        ""
      ).trim() || null
    );
  }
}
