import type { FieldRouteMode } from '@/lib/field/types';

const DAILY_COUNT_KEY = 'gyeongmaejigi:fieldRouteDailyCount';
const START_KEY = 'gyeongmaejigi:fieldRouteStart';
const MODE_KEY = 'gyeongmaejigi:fieldRouteMode';

export function loadDailyCount(): number {
  if (typeof window === 'undefined') return 3;
  const raw = localStorage.getItem(DAILY_COUNT_KEY);
  const n = raw ? Number(raw) : 3;
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(10, Math.floor(n)));
}

export function saveDailyCount(n: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    DAILY_COUNT_KEY,
    String(Math.max(1, Math.min(10, Math.floor(n)))),
  );
}

export function loadSavedStart(): { lat: number; lng: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(START_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
    if (
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number' &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    return null;
  }
  return null;
}

export function saveStartPoint(lat: number, lng: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(START_KEY, JSON.stringify({ lat, lng }));
}

export function loadRouteMode(): FieldRouteMode {
  if (typeof window === 'undefined') return 'car';
  const raw = localStorage.getItem(MODE_KEY);
  return raw === 'transit' ? 'transit' : 'car';
}

export function saveRouteMode(mode: FieldRouteMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODE_KEY, mode);
}
