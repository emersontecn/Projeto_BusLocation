
export interface RouteGeometry {
  coordinates: [number, number][];
}

/**
 * Fetches routing geometry between multiple stops using OSRM API.
 * OSRM expects coordinates in [longitude, latitude] format.
 */
export async function fetchRouteGeometry(stops: { lat: number; lng: number }[]): Promise<[number, number][]> {
  if (stops.length < 2) return [];

  // OSRM coordinates format is long,lat
  const coordsString = stops.map(s => `${s.lng},${s.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&continue_straight=true`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('OSRM routing failed:', data);
      // Fallback: return direct lines if routing fails
      return stops.map(s => [s.lat, s.lng]);
    }

    // OSRM returns [long, lat], Leaflet needs [lat, long]
    return data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
  } catch (error) {
    console.error('Error fetching route geometry:', error);
    return stops.map(s => [s.lat, s.lng]);
  }
}
