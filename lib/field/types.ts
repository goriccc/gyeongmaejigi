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

export type FieldRouteDay = {
  dayIndex: number;
  label: string;
  stops: RouteStop[];
  totalDistanceM?: number;
  totalDurationMs?: number;
  path?: GeoPoint[];
};

export type FieldRoutePlan = {
  dailyCount: number;
  startPoint: GeoPoint | null;
  days: FieldRouteDay[];
  missingGeoCaseIds: string[];
};

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
