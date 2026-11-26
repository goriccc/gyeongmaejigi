import type { CaseFile } from '@/types/case';
import { isArchivedCase, normalizeCaseTrack, parseAuctionTime } from '@/lib/caseUtils';
import { extractSigunguKey, shortenSigunguLabel } from '@/lib/field/sigungu';
import type {
  FieldCustomDays,
  FieldPackMode,
  FieldRouteDay,
  FieldRoutePlan,
  GeoPoint,
  RouteStop,
} from '@/lib/field/types';

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
    if (c.bidOutcome === 'won') continue;
    if (!c.address?.trim() && !c.auctionDate) continue;
    if (caseHasGeo(c)) routable.push(c);
    else missingGeo.push(c);
  }

  routable.sort(
    (a, b) => parseAuctionTime(a.auctionDate) - parseAuctionTime(b.auctionDate),
  );

  return { routable, missingGeo };
}

export function clampDailyCount(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(10, Math.floor(n)));
}

/** 마감일 우선으로 일별 N건씩 묶습니다. */
export function packCasesByDailyCount(
  cases: CaseFile[],
  dailyCount: number,
): CaseFile[][] {
  const n = clampDailyCount(dailyCount);
  const days: CaseFile[][] = [];
  for (let i = 0; i < cases.length; i += n) {
    days.push(cases.slice(i, i + n));
  }
  return days;
}

function centroid(cases: CaseFile[]): GeoPoint | null {
  if (cases.length === 0) return null;
  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const c of cases) {
    if (!caseHasGeo(c)) continue;
    lat += c.latitude as number;
    lng += c.longitude as number;
    n += 1;
  }
  if (n === 0) return null;
  return { lat: lat / n, lng: lng / n };
}

/**
 * 시·군·구 우선: 출발지에서 가까운 권역부터, 권역 안은 마감일 순.
 * 이어 붙인 뒤 하루 N건으로 자릅니다.
 */
export function packCasesByRegion(
  cases: CaseFile[],
  dailyCount: number,
  start: GeoPoint,
): CaseFile[][] {
  const groups = new Map<string, CaseFile[]>();
  for (const c of cases) {
    const key = extractSigunguKey(c.address);
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  for (const list of groups.values()) {
    list.sort(
      (a, b) => parseAuctionTime(a.auctionDate) - parseAuctionTime(b.auctionDate),
    );
  }

  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const ca = centroid(groups.get(a)!);
    const cb = centroid(groups.get(b)!);
    const da = ca ? haversineM(start, ca) : Number.POSITIVE_INFINITY;
    const db = cb ? haversineM(start, cb) : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.localeCompare(b, 'ko');
  });

  const flat: CaseFile[] = [];
  for (const key of orderedKeys) {
    flat.push(...(groups.get(key) ?? []));
  }
  return packCasesByDailyCount(flat, dailyCount);
}

export function dayRegionLabel(cases: CaseFile[]): string | undefined {
  if (cases.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const c of cases) {
    const key = extractSigunguKey(c.address);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], 'ko');
  });
  const top = ranked.slice(0, 2).map(([k]) => shortenSigunguLabel(k));
  return top.join('·');
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

function daysFromGroups(
  packed: CaseFile[][],
  start: GeoPoint,
  packMode: FieldPackMode,
): FieldRouteDay[] {
  return packed.map((group, dayIndex) => {
    const rawStops = group.map((c, i) => caseToRouteStop(c, i + 1));
    const stops = optimizeVisitOrder(rawStops, start);
    const regionLabel =
      packMode === 'region' ? dayRegionLabel(group) : undefined;
    return {
      dayIndex,
      label: `${dayIndex + 1}일차`,
      regionLabel,
      stops,
    };
  });
}

/**
 * 직접 설정 배치를 현재 동선 가능 사건과 맞춥니다.
 * 사라진 id는 제거하고, 새 사건은 마지막 날에 붙입니다.
 */
export function reconcileCustomDays(
  customDays: FieldCustomDays | null | undefined,
  routable: CaseFile[],
  dailyCount: number,
): FieldCustomDays {
  const routableIds = new Set(routable.map((c) => c.id));

  if (!customDays || customDays.length === 0) {
    return packCasesByDailyCount(routable, dailyCount).map((g) =>
      g.map((c) => c.id),
    );
  }

  const seen = new Set<string>();
  const next: FieldCustomDays = [];
  for (const day of customDays) {
    const kept = day.filter((id) => {
      if (!routableIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    next.push(kept);
  }

  const missing = routable.filter((c) => !seen.has(c.id));
  if (missing.length > 0) {
    if (next.length === 0) next.push([]);
    next[next.length - 1]!.push(...missing.map((c) => c.id));
  }

  const cleaned = next.filter((d, i) => d.length > 0 || i === 0);
  if (cleaned.length === 0) {
    return packCasesByDailyCount(routable, dailyCount).map((g) =>
      g.map((c) => c.id),
    );
  }
  return cleaned;
}

export function customDaysToCaseGroups(
  customDays: FieldCustomDays,
  routable: CaseFile[],
): CaseFile[][] {
  const byId = new Map(routable.map((c) => [c.id, c]));
  return customDays
    .map((ids) => ids.map((id) => byId.get(id)).filter(Boolean) as CaseFile[])
    .filter((g) => g.length > 0);
}

export function moveCaseBetweenDays(
  days: FieldCustomDays,
  caseId: string,
  fromDay: number,
  toDay: number,
): FieldCustomDays {
  if (fromDay === toDay || fromDay < 0 || toDay < 0 || fromDay >= days.length) {
    return days.map((d) => [...d]);
  }
  const next = days.map((d) => [...d]);
  while (next.length <= toDay) next.push([]);
  const from = next[fromDay]!;
  const idx = from.indexOf(caseId);
  if (idx < 0) return next;
  from.splice(idx, 1);
  next[toDay]!.push(caseId);
  const filtered = next.filter((d) => d.length > 0);
  return filtered.length > 0 ? filtered : [[]];
}

export type BuildFieldRoutePlanOptions = {
  dailyCount: number;
  packMode?: FieldPackMode;
  startPoint?: GeoPoint | null;
  customDays?: FieldCustomDays | null;
};

export function buildFieldRoutePlan(
  cases: CaseFile[],
  dailyCountOrOptions: number | BuildFieldRoutePlanOptions,
  startPointArg?: GeoPoint | null,
): FieldRoutePlan {
  const options: BuildFieldRoutePlanOptions =
    typeof dailyCountOrOptions === 'number'
      ? { dailyCount: dailyCountOrOptions, startPoint: startPointArg }
      : dailyCountOrOptions;

  const packMode: FieldPackMode = options.packMode ?? 'deadline';
  const dailyCount = clampDailyCount(options.dailyCount);
  const start = options.startPoint ?? DEFAULT_START;
  const { routable, missingGeo } = filterRoutableCases(cases);

  let packed: CaseFile[][];
  if (packMode === 'region') {
    packed = packCasesByRegion(routable, dailyCount, start);
  } else if (packMode === 'custom') {
    const reconciled = reconcileCustomDays(
      options.customDays,
      routable,
      dailyCount,
    );
    packed = customDaysToCaseGroups(reconciled, routable);
  } else {
    packed = packCasesByDailyCount(routable, dailyCount);
  }

  return {
    packMode,
    dailyCount,
    startPoint: start,
    days: daysFromGroups(packed, start, packMode),
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

export function packModeTitle(mode: FieldPackMode): string {
  switch (mode) {
    case 'region':
      return '유사지역 우선 임장 동선';
    case 'custom':
      return '직접 설정 임장 동선';
    default:
      return '마감일 우선 임장 동선';
  }
}

export function packModeHint(mode: FieldPackMode): string {
  switch (mode) {
    case 'region':
      return '출발지에서 가까운 시·군·구끼리 묶고, 권역 안에서는 마감일 순입니다.';
    case 'custom':
      return '일차별 건수를 정한 뒤, 목록에서 사건을 다른 날로 옮깁니다.';
    default:
      return '입찰 마감일이 빠른 사건부터 하루 건수만큼 묶습니다.';
  }
}
