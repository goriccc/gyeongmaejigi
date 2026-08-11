import type {
  FieldRouteApiResponse,
  FieldRouteApiStop,
  FieldRouteGuideItem,
  FieldRouteLegGuide,
  GeoPoint,
} from '@/lib/field/types';

const NAVI_BASE = 'https://apis-navi.kakaomobility.com/v1';
const TRANSIT_BASE = 'https://dapi.kakao.com/v2/routing/publictraffic';

type KakaoTransitRoute = {
  properties: {
    totalDistance: number;
    totalTime: number;
  };
  steps: Array<{
    properties?: {
      guidance?: string;
      type?: string;
      distance?: number;
      time?: number;
      vehicles?: Array<{ name?: string; type?: string }>;
    };
    path?: { points?: number[][] };
  }>;
};

type KakaoTransitResponse = {
  status: string;
  routes?: KakaoTransitRoute[];
};

type KakaoDirectionsRoute = {
  summary?: { distance?: number; duration?: number };
  sections?: Array<{
    roads?: Array<{ name?: string; vertexes?: number[] }>;
  }>;
};

type RouteSegmentResult = {
  path: GeoPoint[];
  distanceM: number;
  durationSec: number;
  guides: FieldRouteGuideItem[];
};

function formatStepMeta(distanceM?: number, durationSec?: number): string | undefined {
  const parts: string[] = [];
  if (typeof distanceM === 'number' && distanceM > 0) {
    parts.push(distanceM < 1000 ? `${distanceM}m` : `${(distanceM / 1000).toFixed(1)}km`);
  }
  if (typeof durationSec === 'number' && durationSec > 0) {
    parts.push(formatRouteDuration(durationSec));
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function formatTransitStepLabel(
  type: string | undefined,
  vehicle?: { name?: string; type?: string },
): string {
  if (type === 'WALKING') return '도보';
  if (type === 'SUBWAY') {
    return vehicle?.name ? `지하철 ${vehicle.name}` : '지하철';
  }
  if (type === 'BUS') {
    if (vehicle?.type && vehicle?.name) {
      const kind = vehicle.type === '마을' ? '마을버스' : `${vehicle.type}버스`;
      return `${kind} ${vehicle.name}`;
    }
    return vehicle?.name ? `버스 ${vehicle.name}` : '버스';
  }
  return type ?? '이동';
}

function parseTransitGuides(route: KakaoTransitRoute): FieldRouteGuideItem[] {
  const items: FieldRouteGuideItem[] = [];
  for (const step of route.steps) {
    const props = step.properties;
    if (!props) continue;

    const vehicle = props.vehicles?.[0];
    const label = formatTransitStepLabel(props.type, vehicle);
    const meta = formatStepMeta(props.distance, props.time);
    const detail =
      props.type === 'WALKING'
        ? meta
        : props.guidance?.trim() || meta;

    items.push({
      label,
      detail,
    });
  }
  return items;
}

function parseDrivingGuides(route: KakaoDirectionsRoute): FieldRouteGuideItem[] {
  const items: FieldRouteGuideItem[] = [];
  const seen = new Set<string>();

  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const name = road.name?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      items.push({ label: name });
    }
  }

  return items;
}

function stopLabel(stop: FieldRouteApiStop, index: number): string {
  return stop.name?.trim() || `${index + 1}번`;
}

function parseVertexes(sections: KakaoDirectionsRoute['sections']): GeoPoint[] {
  const path: GeoPoint[] = [];
  for (const section of sections ?? []) {
    for (const road of section.roads ?? []) {
      const v = road.vertexes ?? [];
      for (let i = 0; i + 1 < v.length; i += 2) {
        path.push({ lng: v[i]!, lat: v[i + 1]! });
      }
    }
  }
  return path;
}

function coordPair(p: GeoPoint, name?: string): string {
  const base = `${p.lng},${p.lat}`;
  return name ? `${base},name=${encodeURIComponent(name)}` : base;
}

async function fetchDrivingSegment(
  apiKey: string,
  origin: GeoPoint,
  destination: GeoPoint,
  waypoints: GeoPoint[],
): Promise<RouteSegmentResult | null> {
  const params = new URLSearchParams({
    origin: coordPair(origin),
    destination: coordPair(destination),
    priority: 'RECOMMEND',
    car_fuel: 'GASOLINE',
    car_hipass: 'false',
    alternatives: 'false',
    road_details: 'true',
  });

  if (waypoints.length > 0) {
    params.set(
      'waypoints',
      waypoints.map((w) => coordPair(w)).join('|'),
    );
  }

  const res = await fetch(`${NAVI_BASE}/directions?${params}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    routes?: KakaoDirectionsRoute[];
  };

  const route = data.routes?.[0];
  if (!route) return null;

  const path = parseVertexes(route.sections);
  if (path.length === 0) return null;

  return {
    path,
    distanceM: route.summary?.distance ?? 0,
    durationSec: route.summary?.duration ?? 0,
    guides: parseDrivingGuides(route),
  };
}

function fallbackResponse(): FieldRouteApiResponse {
  return {
    path: [],
    distanceM: 0,
    durationSec: 0,
    fallback: true,
    legs: [],
  };
}

function parseTransitPath(route: KakaoTransitRoute): GeoPoint[] {
  const path: GeoPoint[] = [];
  for (const step of route.steps) {
    for (const point of step.path?.points ?? []) {
      const lng = point[0];
      const lat = point[1];
      if (typeof lng === 'number' && typeof lat === 'number') {
        path.push({ lng, lat });
      }
    }
  }
  return path;
}

async function fetchTransitSegment(
  apiKey: string,
  origin: GeoPoint,
  destination: GeoPoint,
): Promise<RouteSegmentResult | null> {
  const params = new URLSearchParams({
    start_x: String(origin.lng),
    start_y: String(origin.lat),
    end_x: String(destination.lng),
    end_y: String(destination.lat),
  });

  const res = await fetch(`${TRANSIT_BASE}?${params}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as KakaoTransitResponse;
  if (data.status !== 'OK' || !data.routes?.[0]) return null;

  const route = data.routes[0];
  const path = parseTransitPath(route);
  if (path.length === 0) return null;

  return {
    path,
    distanceM: route.properties.totalDistance ?? 0,
    durationSec: route.properties.totalTime ?? 0,
    guides: parseTransitGuides(route),
  };
}

async function fetchDrivingLegSegment(
  apiKey: string,
  origin: GeoPoint,
  destination: GeoPoint,
): Promise<RouteSegmentResult | null> {
  return fetchDrivingSegment(apiKey, origin, destination, []);
}

/** 출발지→경유지 순으로 구간별 대중교통 경로를 조회해 병합합니다. */
export async function fetchKakaoTransitRoute(
  apiKey: string,
  origin: GeoPoint,
  stops: FieldRouteApiStop[],
): Promise<FieldRouteApiResponse> {
  if (stops.length === 0) {
    return { path: [], distanceM: 0, durationSec: 0, fallback: true, legs: [] };
  }

  const allPath: GeoPoint[] = [];
  const legs: FieldRouteLegGuide[] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let from = origin;
  let fromLabel = '출발';

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index]!;
    const dest = { lat: stop.lat, lng: stop.lng };
    const toLabel = stopLabel(stop, index);
    const segment = await fetchTransitSegment(apiKey, from, dest);
    if (!segment) return fallbackResponse();

    legs.push({
      from: fromLabel,
      to: toLabel,
      items: segment.guides,
      path: segment.path,
    });
    allPath.push(...(allPath.length ? segment.path.slice(1) : segment.path));
    totalDistance += segment.distanceM;
    totalDuration += segment.durationSec;
    from = dest;
    fromLabel = toLabel;
  }

  return {
    path: allPath,
    distanceM: totalDistance,
    durationSec: totalDuration,
    fallback: false,
    legs,
  };
}

/** 출발지→임장지 순으로 구간별 자차 경로를 조회해 병합합니다. */
export async function fetchKakaoDrivingRoute(
  apiKey: string,
  origin: GeoPoint,
  stops: FieldRouteApiStop[],
): Promise<FieldRouteApiResponse> {
  if (stops.length === 0) {
    return { path: [], distanceM: 0, durationSec: 0, fallback: true, legs: [] };
  }

  const allPath: GeoPoint[] = [];
  const legs: FieldRouteLegGuide[] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let from = origin;
  let fromLabel = '출발';

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index]!;
    const dest = { lat: stop.lat, lng: stop.lng };
    const toLabel = stopLabel(stop, index);
    const segment = await fetchDrivingLegSegment(apiKey, from, dest);
    if (!segment) return fallbackResponse();

    legs.push({
      from: fromLabel,
      to: toLabel,
      items: segment.guides,
      path: segment.path,
    });
    allPath.push(...(allPath.length ? segment.path.slice(1) : segment.path));
    totalDistance += segment.distanceM;
    totalDuration += segment.durationSec;
    from = dest;
    fromLabel = toLabel;
  }

  return {
    path: allPath,
    distanceM: totalDistance,
    durationSec: totalDuration,
    fallback: false,
    legs,
  };
}

export function formatRouteDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export function formatRouteDistance(m: number): string {
  if (m <= 0) return '—';
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}
