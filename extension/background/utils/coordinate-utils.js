/**
 * Utility functions for coordinate and location handling
 */
export class CoordinateUtils {
  /**
   * Extract EVA number from halt data
   * @param {Object} halt - Halt object from API
   * @returns {string|null} EVA number or null
   */
  static extractEva(halt) {
    return (
      halt?.ort?.evaNr || halt?.ort?.locationId?.match(/L=(\d+)@/i)?.[1] || null
    );
  }

  /**
   * Extract location coordinates from ort object
   * @param {Object} ort - Ort object from API
   * @returns {Object|null} Location object with latitude/longitude
   */
  static extractLocation(ort) {
    if (!ort) return null;

    let location = null;

    if (ort.koordinaten) {
      location = {
        latitude: ort.koordinaten.latitude || ort.koordinaten.y,
        longitude: ort.koordinaten.longitude || ort.koordinaten.x,
      };
    } else if (ort.latitude && ort.longitude) {
      location = { latitude: ort.latitude, longitude: ort.longitude };
    } else if (ort.x && ort.y) {
      location = { latitude: ort.y, longitude: ort.x };
    }

    return location;
  }

  /**
   * Enrich nodes with missing coordinates by querying locations API
   * @param {Array} nodes - Array of route nodes
   */
  static async enrichNodesWithCoordinates(nodes) {
    const nodesWithoutCoords = nodes.filter((n) => !n.location && n.name);

    for (const node of nodesWithoutCoords) {
      try {
        let locations = await self.DBNavLite.dbnavLocations(node.name, 1);

        if ((!locations || locations.length === 0) && node.eva) {
          locations = await self.DBNavLite.dbnavLocations(node.eva, 1);
        }

        const loc = locations?.[0];
        if (loc) {
          const coords = this.extractCoordinatesFromLocation(loc);
          if (coords) {
            node.location = coords;
          }
        }
      } catch (e) {
        // Silently continue if coordinate fetch fails
      }
    }
  }

  /**
   * Extract coordinates from various location object formats
   * @param {Object} loc - Location object from API
   * @returns {Object|null} Normalized coordinates
   */
  static extractCoordinatesFromLocation(loc) {
    let coords = null;

    if (loc.koordinaten) {
      coords = loc.koordinaten;
    } else if (loc.coordinate) {
      coords = loc.coordinate;
    } else if (loc.coordinates) {
      coords = loc.coordinates;
    } else if (loc.x && loc.y) {
      coords = { x: loc.x, y: loc.y };
    } else if (loc.latitude && loc.longitude) {
      coords = { latitude: loc.latitude, longitude: loc.longitude };
    } else if (loc.lat && loc.lng) {
      coords = { latitude: loc.lat, longitude: loc.lng };
    } else if (loc.position) {
      coords = loc.position;
    }

    if (coords) {
      return {
        latitude: coords.latitude || coords.lat || coords.y,
        longitude: coords.longitude || coords.lng || coords.lon || coords.x,
      };
    }

    return null;
  }
}
