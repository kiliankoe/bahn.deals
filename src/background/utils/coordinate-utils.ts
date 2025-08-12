export class CoordinateUtils {
  static extractEva(halt: any): string | null {
    return (
      halt?.ort?.evaNr || halt?.ort?.locationId?.match(/L=(\d+)@/i)?.[1] || null
    );
  }

  static extractLocation(ort: any) {
    if (!ort) return null;
    let location: any = null;
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

  static async enrichNodesWithCoordinates(nodes: any[]) {
    const nodesWithoutCoords = nodes.filter((n) => !n.location && n.name);
    // dbnavLocations is invoked from services; keep this function pure here.
    // The route parsing will enrich coordinates using the locations API.
  }

  static extractCoordinatesFromLocation(loc: any) {
    let coords: any = null;
    if (loc.koordinaten) coords = loc.koordinaten;
    else if (loc.coordinate) coords = loc.coordinate;
    else if (loc.coordinates) coords = loc.coordinates;
    else if (loc.x && loc.y) coords = { x: loc.x, y: loc.y };
    else if (loc.latitude && loc.longitude) coords = { latitude: loc.latitude, longitude: loc.longitude };
    else if (loc.lat && loc.lng) coords = { latitude: loc.lat, longitude: loc.lng };
    else if (loc.position) coords = loc.position;

    if (coords) {
      return {
        latitude: coords.latitude || coords.lat || coords.y,
        longitude: coords.longitude || coords.lng || coords.lon || coords.x,
      };
    }
    return null;
  }
}

