import type { FieldRouteLegGuide, FieldRouteMode, GeoPoint } from '@/lib/field/types';

export type FieldRouteCacheEntry = {
  path: GeoPoint[];
  summary: { distanceLabel: string; durationLabel: string } | null;
  legs: FieldRouteLegGuide[];
};

type StoredEntry = FieldRouteCacheEntry & { cachedAt: number };
type CacheStore = Record<string, StoredEntry>;

const CACHE_KEY = 'gyeongmaejigi:fieldRouteCache';
const MAX_ENTRIES = 24;

const memory = new Map<string, FieldRouteCacheEntry>();

function roundCoord(n: number): string {
  return n.toFixed(5);
}

export function buildRouteCacheKey(
  mode: FieldRouteMode,
  origin: GeoPoint,
  stops: Array<{ caseId?: string; lat: number; lng: number }>,
): string {
  const originPart = `${roundCoord(origin.lat)},${roundCoord(origin.lng)}`;
  const stopsPart = stops
    .map(
      (s) =>
        `${s.caseId ?? 'point'}@${roundCoord(s.lat)},${roundCoord(s.lng)}`,
    )
    .join('|');
  return `v2:${mode}:${originPart}:${stopsPart}`;
}

function loadStore(): CacheStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheStore;
  } catch {
    return {};
  }
}

function saveStore(store: CacheStore): void {
  if (typeof window === 'undefined') return;
  const trimmed = Object.fromEntries(
    Object.entries(store)
      .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
      .slice(0, MAX_ENTRIES),
  );
  localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
}

export function getCachedRoute(key: string): FieldRouteCacheEntry | null {
  const mem = memory.get(key);
  if (mem) return mem;

  const stored = loadStore()[key];
  if (!stored) return null;

  const entry: FieldRouteCacheEntry = {
    path: stored.path,
    summary: stored.summary,
    legs: stored.legs,
  };
  memory.set(key, entry);
  return entry;
}

export function setCachedRoute(key: string, entry: FieldRouteCacheEntry): void {
  memory.set(key, entry);
  const store = loadStore();
  store[key] = { ...entry, cachedAt: Date.now() };
  saveStore(store);
}
