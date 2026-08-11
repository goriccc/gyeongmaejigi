import type { GeoPoint, RouteStop } from '@/lib/field/types';

function dist2(a: GeoPoint, b: GeoPoint): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

function nearestPathIndex(path: GeoPoint[], point: GeoPoint): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i += 1) {
    const d = dist2(path[i]!, point);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** 병합 path를 임장지 순서대로 구간별로 나눕니다. (캐시 등 구간 path 없을 때 fallback) */
export function splitPathByStops(
  path: GeoPoint[],
  stops: RouteStop[],
): GeoPoint[][] {
  if (path.length < 2 || stops.length === 0) return [];

  const indices = stops.map((stop) =>
    nearestPathIndex(path, { lat: stop.lat, lng: stop.lng }),
  );

  for (let i = 1; i < indices.length; i += 1) {
    indices[i] = Math.max(indices[i]!, indices[i - 1]!);
  }

  const segments: GeoPoint[][] = [];
  let startIdx = 0;

  for (const endIdx of indices) {
    if (endIdx > startIdx) {
      segments.push(path.slice(startIdx, endIdx + 1));
    }
    startIdx = endIdx;
  }

  return segments.filter((segment) => segment.length >= 2);
}

export function resolveRoutePathLegs(
  path: GeoPoint[],
  legs: Array<{ path?: GeoPoint[] }> | undefined,
  stops: RouteStop[],
): GeoPoint[][] {
  const fromApi = (legs ?? [])
    .map((leg) => leg.path ?? [])
    .filter((segment) => segment.length >= 2);

  if (fromApi.length > 0) return fromApi;
  return splitPathByStops(path, stops);
}
