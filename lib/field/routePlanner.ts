import type { CaseFile } from '@/types/case';
import { isArchivedCase, normalizeCaseTrack, parseAuctionTime } from '@/lib/caseUtils';
import type { FieldRouteDay, FieldRoutePlan, GeoPoint, RouteStop } from '@/lib/field/types';

const DEFAULT_START: GeoPoint = { lat: 37.5665, lng: 126.978 };

export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function caseHasGeo(c: CaseFile): boolean {
  return (
    typeof c.latitude === 'number' &&
    typeof c.longitude === 'number' &&
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude)
  );
}

export function filterRoutableCases(cases: CaseFile[]): {
  routable: CaseFile[];
  missingGeo: CaseFile[];
} {
  const routable: CaseFile[] = [];
  const missingGeo: CaseFile[] = [];

  for (const c of cases) {
    if (normalizeCaseTrack(c) !== 'bidding' || isArchivedCase(c)) continue;
    if (!c.address?.trim() && !c.auctionDate) continue;
    if (caseHasGeo(c)) routable.push(c);
    else missingGeo.push(c);
  }

  routable.sort(
    (a, b) => parseAuctionTime(a.auctionDate) - parseAuctionTime(b.auctionDate),
  );

  return { routable, missingGeo };
}

/** 마감일 우선으로 일별 N건씩 묶습니다. */
export function packCasesByDailyCount(
  cases: CaseFile[],
  dailyCount: number,
): CaseFile[][] {
  const n = Math.max(1, Math.min(10, Math.floor(dailyCount)));
  const days: CaseFile[][] = [];
  for (let i = 0; i < cases.length; i += n) {
    days.push(cases.slice(i, i + n));
  }
  return days;
}

/** Nearest-neighbor + 2-opt (Haversine). */
export function optimizeVisitOrder(
  stops: RouteStop[],
  start: GeoPoint,
): RouteStop[] {
  if (stops.length <= 1) {
    return stops.map((s, i) => ({ ...s, order: i + 1 }));
  }

  const remaining = new Set(stops.map((_, i) => i));
  let order: number[] = [];
  let cursor = start;

  while (remaining.size > 0) {
    let bestIdx = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const idx of remaining) {
      const s = stops[idx]!;
      const d = haversineM(cursor, { lat: s.lat, lng: s.lng });
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    }
    remaining.delete(bestIdx);
    order.push(bestIdx);
    const picked = stops[bestIdx]!;
    cursor = { lat: picked.lat, lng: picked.lng };
  }

  const seqDistance = (seq: number[]) => {
    let total = 0;
    let c = start;
    for (const idx of seq) {
      const s = stops[idx]!;
      total += haversineM(c, { lat: s.lat, lng: s.lng });
      c = { lat: s.lat, lng: s.lng };
    }
    return total;
  };

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, j + 1).reverse(),
          ...order.slice(j + 1),
        ];
        if (seqDistance(candidate) + 1 < seqDistance(order)) {
          order = candidate;
          improved = true;
        }
      }
    }
  }

  return order.map((idx, i) => ({ ...stops[idx]!, order: i + 1 }));
}

export function caseToRouteStop(c: CaseFile, order: number): RouteStop {
  return {
    caseId: c.id,
    order,
    lat: c.latitude as number,
    lng: c.longitude as number,
    name: c.name,
    address: c.address,
    caseNumber: c.caseNumber,
    auctionDate: c.auctionDate,
  };
}

export function buildFieldRoutePlan(
  cases: CaseFile[],
  dailyCount: number,
  startPoint?: GeoPoint | null,
): FieldRoutePlan {
  const start = startPoint ?? DEFAULT_START;
  const { routable, missingGeo } = filterRoutableCases(cases);
  const packed = packCasesByDailyCount(routable, dailyCount);

  const days: FieldRouteDay[] = packed.map((group, dayIndex) => {
    const rawStops = group.map((c, i) => caseToRouteStop(c, i + 1));
    const stops = optimizeVisitOrder(rawStops, start);
    return {
      dayIndex,
      label: `${dayIndex + 1}일차`,
      stops,
    };
  });

  return {
    dailyCount: Math.max(1, Math.min(10, Math.floor(dailyCount))),
    startPoint: start,
    days,
    missingGeoCaseIds: missingGeo.map((c) => c.id),
  };
}

/** API 없을 때 직선 경로 */
export function straightPath(
  start: GeoPoint,
  stops: RouteStop[],
): GeoPoint[] {
  const path: GeoPoint[] = [start];
  for (const s of stops) {
    path.push({ lat: s.lat, lng: s.lng });
  }
  return path;
}
