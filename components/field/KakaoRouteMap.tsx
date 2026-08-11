'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRouteLegColor } from '@/lib/field/routeLegColors';
import { resolveRoutePathLegs } from '@/lib/field/routePathSplit';
import type { GeoPoint, RouteStop } from '@/lib/field/types';

type Props = {
  start: GeoPoint | null;
  stops: RouteStop[];
  path: GeoPoint[];
  pathLegs?: GeoPoint[][];
  pathLoading?: boolean;
  selectedCaseId: string | null;
  onSelectStop: (caseId: string) => void;
};

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (cb: () => void) => void;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        LatLngBounds: new () => KakaoLatLngBounds;
        Map: new (
          el: HTMLElement,
          opts: { center: KakaoLatLng; level: number },
        ) => KakaoMap;
        Marker: new (opts: {
          map: KakaoMap;
          position: KakaoLatLng;
          zIndex?: number;
        }) => KakaoMarker;
        Polyline: new (opts: {
          map: KakaoMap;
          path: KakaoLatLng[];
          strokeWeight: number;
          strokeColor: string;
          strokeOpacity: number;
          strokeStyle: string;
        }) => KakaoPolyline;
        CustomOverlay: new (opts: {
          map: KakaoMap;
          position: KakaoLatLng;
          content: HTMLElement;
          yAnchor?: number;
        }) => KakaoCustomOverlay;
        event: {
          addListener: (
            target: KakaoMap | KakaoMarker,
            type: string,
            handler: () => void,
          ) => void;
        };
      };
    };
  }
}

type KakaoLatLng = object;
type KakaoLatLngBounds = {
  extend: (latlng: KakaoLatLng) => void;
};
type KakaoMap = {
  setBounds: (bounds: KakaoLatLngBounds, padding?: number) => void;
};
type KakaoMarker = object;
type KakaoPolyline = { setMap: (map: KakaoMap | null) => void };
type KakaoCustomOverlay = { setMap: (map: KakaoMap | null) => void };

const APP_KEY = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY?.trim() ?? '';

function loadKakaoMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.kakao?.maps) {
    return new Promise((resolve) => {
      window.kakao!.maps.load(() => resolve());
    });
  }

  return new Promise((resolve, reject) => {
    if (!APP_KEY) {
      reject(new Error('KAKAO_JAVASCRIPT_KEY'));
      return;
    }
    const existing = document.querySelector(
      'script[data-kakao-maps="true"]',
    );
    if (existing) {
      existing.addEventListener('load', () => {
        window.kakao?.maps.load(() => resolve());
      });
      return;
    }
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&autoload=false`;
    script.async = true;
    script.dataset.kakaoMaps = 'true';
    script.onload = () => {
      window.kakao?.maps.load(() => resolve());
    };
    script.onerror = () => reject(new Error('sdk_load'));
    document.head.appendChild(script);
  });
}

function makePinEl(
  label: string,
  active: boolean,
  variant: 'stop' | 'start' = 'stop',
): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `kakao-route-pin${variant === 'start' ? ' is-start' : ''}${active ? ' is-active' : ''}`;
  el.textContent = label;
  el.setAttribute('role', 'button');
  el.setAttribute(
    'aria-label',
    variant === 'start' ? '출발지' : `${label}번 임장지`,
  );
  return el;
}

function isLegDestinationActive(
  legIndex: number,
  stops: RouteStop[],
  selectedCaseId: string | null,
): boolean {
  const dest = stops[legIndex];
  return Boolean(dest && dest.caseId === selectedCaseId);
}

function resolvePathSegments(
  path: GeoPoint[],
  pathLegs: GeoPoint[][] | undefined,
  stops: RouteStop[],
): GeoPoint[][] {
  if (pathLegs && pathLegs.some((segment) => segment.length >= 2)) {
    return pathLegs.filter((segment) => segment.length >= 2);
  }
  return resolveRoutePathLegs(path, undefined, stops);
}

function computeRouteBounds(
  kakao: NonNullable<Window['kakao']>['maps'],
  start: GeoPoint | null,
  stops: RouteStop[],
  pathSegments: GeoPoint[][],
): KakaoLatLngBounds {
  const bounds = new kakao.LatLngBounds();
  const extend = (point: GeoPoint) => {
    bounds.extend(new kakao.LatLng(point.lat, point.lng));
  };

  if (start) extend(start);
  for (const stop of stops) extend(stop);
  for (const segment of pathSegments) {
    for (const point of segment) extend(point);
  }

  if (!start && stops.length === 0 && pathSegments.length === 0) {
    extend({ lat: 37.5665, lng: 126.978 });
  }

  return bounds;
}

export function KakaoRouteMap({
  start,
  stops,
  path,
  pathLegs,
  pathLoading = false,
  selectedCaseId,
  onSelectStop,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const polylinesRef = useRef<KakaoPolyline[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);

  const pathSegments = useMemo(
    () => (!pathLoading ? resolvePathSegments(path, pathLegs, stops) : []),
    [path, pathLegs, pathLoading, stops],
  );

  const hasFitTarget = Boolean(
    start ||
      stops.length > 0 ||
      pathSegments.some((segment) => segment.length >= 2),
  );

  const fitFullRoute = useCallback(() => {
    if (!mapRef.current || !window.kakao?.maps || !hasFitTarget) return;
    const bounds = computeRouteBounds(
      window.kakao.maps,
      start,
      stops,
      pathSegments,
    );
    mapRef.current.setBounds(bounds, 48);
  }, [hasFitTarget, pathSegments, start, stops]);

  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps()
      .then(() => {
        if (!cancelled) setSdkReady(true);
      })
      .catch(() => {
        if (!cancelled) setSdkError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sdkReady || !containerRef.current || !window.kakao?.maps) return;

    const kakao = window.kakao.maps;
    const centerPoint =
      stops[0] ?? start ?? { lat: 37.5665, lng: 126.978 };
    const center = new kakao.LatLng(centerPoint.lat, centerPoint.lng);

    if (!mapRef.current) {
      mapRef.current = new kakao.Map(containerRef.current, {
        center,
        level: 8,
      });
    }

    const map = mapRef.current;

    for (const ov of overlaysRef.current) {
      ov.setMap(null);
    }
    overlaysRef.current = [];
    for (const line of polylinesRef.current) {
      line.setMap(null);
    }
    polylinesRef.current = [];

    const bounds = computeRouteBounds(kakao, start, stops, pathSegments);

    if (start) {
      const startPos = new kakao.LatLng(start.lat, start.lng);
      const startPin = makePinEl('S', false, 'start');
      const startOverlay = new kakao.CustomOverlay({
        map,
        position: startPos,
        content: startPin,
        yAnchor: 1.2,
      });
      overlaysRef.current.push(startOverlay);
    }

    for (const stop of stops) {
      const pos = new kakao.LatLng(stop.lat, stop.lng);
      const pin = makePinEl(String(stop.order), stop.caseId === selectedCaseId);
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectStop(stop.caseId);
      });
      const overlay = new kakao.CustomOverlay({
        map,
        position: pos,
        content: pin,
        yAnchor: 1.2,
      });
      overlaysRef.current.push(overlay);
    }

    for (const [legIndex, segment] of pathSegments.entries()) {
      const latlngs = segment.map((p) => new kakao.LatLng(p.lat, p.lng));
      const active = isLegDestinationActive(legIndex, stops, selectedCaseId);
      polylinesRef.current.push(
        new kakao.Polyline({
          map,
          path: latlngs,
          strokeWeight: active ? 5 : 4,
          strokeColor: getRouteLegColor(legIndex),
          strokeOpacity: 0.88,
          strokeStyle: 'solid',
        }),
      );
    }

    map.setBounds(bounds, 48);
  }, [
    sdkReady,
    start,
    stops,
    pathSegments,
    selectedCaseId,
    onSelectStop,
  ]);

  if (sdkError || !APP_KEY) {
    return (
      <FallbackMap
        start={start}
        stops={stops}
        path={path}
        pathLegs={pathLegs}
        pathLoading={pathLoading}
        selectedCaseId={selectedCaseId}
        onSelectStop={onSelectStop}
        sdkError={sdkError}
      />
    );
  }

  return (
    <div className="kakao-route-map-shell">
      <div
        ref={containerRef}
        className="kakao-route-map"
        aria-label="카카오 지도 임장 동선"
      />
      {hasFitTarget ? (
        <button
          type="button"
          className="btn btn-outline btn-sm kakao-route-map-fit-btn"
          onClick={fitFullRoute}
        >
          전체 임장경로 보기
        </button>
      ) : null}
    </div>
  );
}

function FallbackMap({
  start,
  stops,
  path,
  pathLegs,
  pathLoading = false,
  selectedCaseId,
  onSelectStop,
  sdkError = false,
}: Props & { sdkError?: boolean }) {
  const allPoints = [
    ...(start ? [start] : []),
    ...stops.map((s) => ({ lat: s.lat, lng: s.lng })),
  ];

  if (allPoints.length === 0) {
    return (
      <div className="route-map route-map-empty">
        <p className="s-note">표시할 좌표가 없습니다.</p>
      </div>
    );
  }

  const lats = allPoints.map((p) => p.lat);
  const lngs = allPoints.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 0.12, 0.008);
  const lngPad = Math.max((maxLng - minLng) * 0.12, 0.008);
  const bounds = {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };

  function toPos(lat: number, lng: number) {
    const top =
      ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 100;
    const left =
      ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    return {
      top: `${Math.min(94, Math.max(6, top))}%`,
      left: `${Math.min(94, Math.max(6, left))}%`,
    };
  }

  const pathSegments = !pathLoading
    ? resolvePathSegments(path, pathLegs, stops)
    : [];

  return (
    <div className="route-map route-map-fallback" aria-label="임장 동선 미리보기">
      {!APP_KEY ? (
        <p className="route-map-fallback-note">
          NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY를 .env.local에 넣고 dev 서버를
          재시작해 주세요.
        </p>
      ) : sdkError ? (
        <p className="route-map-fallback-note">
          카카오 지도 SDK 로드 실패 — JavaScript SDK 도메인에
          http://localhost:3000 이 등록됐는지 확인해 주세요.
        </p>
      ) : null}
      {pathSegments.map((segment, legIndex) =>
        segment.map((point, index) => {
          if (index === 0) return null;
          const prev = segment[index - 1]!;
          const from = toPos(prev.lat, prev.lng);
          const to = toPos(point.lat, point.lng);
          const dx = parseFloat(to.left) - parseFloat(from.left);
          const dy = parseFloat(to.top) - parseFloat(from.top);
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const active = isLegDestinationActive(legIndex, stops, selectedCaseId);
          return (
            <div
              key={`leg-${legIndex}-line-${index}`}
              className="route-line"
              style={{
                top: from.top,
                left: from.left,
                width: `${length}%`,
                transform: `rotate(${angle}deg)`,
                transformOrigin: '0 50%',
                borderTopWidth: active ? 2 : 1,
                borderTopColor: getRouteLegColor(legIndex),
                opacity: 0.88,
              }}
            />
          );
        }),
      )}
      {start ? (
        <div
          className="route-pin is-start"
          style={toPos(start.lat, start.lng)}
          title="출발지"
          aria-label="출발지"
        >
          S
        </div>
      ) : null}
      {stops.map((stop) => {
        const pos = toPos(stop.lat, stop.lng);
        return (
          <button
            key={stop.caseId}
            type="button"
            className={`route-pin${stop.caseId === selectedCaseId ? ' is-active' : ''}`}
            style={{ top: pos.top, left: pos.left }}
            title={stop.address || stop.name}
            onClick={() => onSelectStop(stop.caseId)}
          >
            {stop.order}
          </button>
        );
      })}
    </div>
  );
}
