export type GeoPoint = { lat: number; lng: number };

export type RouteStop = {
  caseId: string;
  order: number;
  lat: number;
  lng: number;
  name: string;
  address?: string;
  caseNumber: string;
  auctionDate: string;
};

/** 임장 동선 묶는 방식 */
export type FieldPackMode = 'deadline' | 'region' | 'custom';

export type FieldRouteDay = {
  dayIndex: number;
  label: string;
  /** 유사지역 모드 등 — 그날 주요 시·군·구 */
  regionLabel?: string;
  stops: RouteStop[];
  totalDistanceM?: number;
  totalDurationMs?: number;
  path?: GeoPoint[];
};

export type FieldRoutePlan = {
  packMode: FieldPackMode;
  dailyCount: number;
  startPoint: GeoPoint | null;
  days: FieldRouteDay[];
  missingGeoCaseIds: string[];
};

/** 직접 설정 — 일차별 사건 id 목록 */
export type FieldCustomDays = string[][];

export type FieldRouteApiStop = {
  lat: number;
  lng: number;
  name?: string;
};

export type FieldRouteMode = 'car' | 'transit';

export type FieldRouteGuideItem = {
  label: string;
  detail?: string;
};

export type FieldRouteLegGuide = {
  from: string;
  to: string;
  items: FieldRouteGuideItem[];
  path?: GeoPoint[];
};

export type FieldRouteApiResponse = {
  path: GeoPoint[];
  distanceM: number;
  durationSec: number;
  fallback?: boolean;
  legs?: FieldRouteLegGuide[];
};
