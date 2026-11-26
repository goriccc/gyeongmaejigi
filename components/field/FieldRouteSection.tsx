'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { KakaoRouteMap } from '@/components/field/KakaoRouteMap';
import { FieldRouteGuide } from '@/components/field/FieldRouteGuide';
import {
  loadCustomDayCounts,
  loadCustomDays,
  loadDailyCount,
  loadPackMode,
  loadRouteMode,
  loadSavedStart,
  saveCustomDayCounts,
  saveCustomDays,
  saveDailyCount,
  savePackMode,
  saveRouteMode,
  saveStartPoint,
} from '@/lib/field/fieldRoutePrefs';
import {
  buildRouteCacheKey,
  getCachedRoute,
  setCachedRoute,
} from '@/lib/field/fieldRouteCache';
import {
  buildFieldRoutePlan,
  clampDailyCount,
  filterRoutableCases,
  moveCaseBetweenDays,
  packModeHint,
  packModeTitle,
  reconcileCustomDays,
} from '@/lib/field/routePlanner';
import { resolveRoutePathLegs } from '@/lib/field/routePathSplit';
import type {
  FieldCustomDays,
  FieldPackMode,
  FieldRouteDay,
  FieldRouteLegGuide,
  FieldRouteMode,
  GeoPoint,
} from '@/lib/field/types';
import { useCases } from '@/lib/hooks/useCases';
import { formatAuctionDateShort } from '@/lib/caseUtils';
import type { CaseFile } from '@/types/case';

function mapSearchUrl(address: string) {
  return `https://map.kakao.com/?q=${encodeURIComponent(address)}`;
}

type RouteSummary = {
  distanceLabel: string;
  durationLabel: string;
} | null;

type FieldRouteSectionProps = {
  onFocusCase?: (caseId: string, order?: number) => void;
};

export function FieldRouteSection({ onFocusCase }: FieldRouteSectionProps = {}) {
  const { cases, updateCase } = useCases();
  const [dailyCount, setDailyCount] = useState(3);
  const [packMode, setPackMode] = useState<FieldPackMode>('deadline');
  const [customDays, setCustomDays] = useState<FieldCustomDays | null>(null);
  const [customDayCounts, setCustomDayCounts] = useState<number[]>([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [startPoint, setStartPoint] = useState<GeoPoint | null>(null);
  const [routeMode, setRouteMode] = useState<FieldRouteMode>('car');
  const [routePath, setRoutePath] = useState<GeoPoint[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary>(null);
  const [routeLegs, setRouteLegs] = useState<FieldRouteLegGuide[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const autoGeocodeDone = useRef(false);
  const prefsReady = useRef(false);

  useEffect(() => {
    setDailyCount(loadDailyCount());
    setStartPoint(loadSavedStart());
    setRouteMode(loadRouteMode());
    setPackMode(loadPackMode());
    setCustomDays(loadCustomDays());
    setCustomDayCounts(loadCustomDayCounts() ?? []);
    prefsReady.current = true;
  }, []);

  const routableIdsKey = useMemo(() => {
    const { routable } = filterRoutableCases(cases);
    return routable.map((c) => c.id).join('|');
  }, [cases]);

  useEffect(() => {
    if (!prefsReady.current || packMode !== 'custom') return;
    const { routable } = filterRoutableCases(cases);
    const next = reconcileCustomDays(customDays, routable, dailyCount);
    const same =
      customDays &&
      customDays.length === next.length &&
      customDays.every(
        (day, i) =>
          day.length === next[i]!.length &&
          day.every((id, j) => id === next[i]![j]),
      );
    if (!same) {
      setCustomDays(next);
      saveCustomDays(next);
      setCustomDayCounts((prev) => {
        const counts = next.map((day, i) =>
          clampDailyCount(prev[i] ?? dailyCount),
        );
        saveCustomDayCounts(counts);
        return counts;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- routableIdsKey drives case membership
  }, [packMode, routableIdsKey, dailyCount]);

  const plan = useMemo(
    () =>
      buildFieldRoutePlan(cases, {
        dailyCount,
        packMode,
        startPoint,
        customDays: packMode === 'custom' ? customDays : null,
      }),
    [cases, dailyCount, packMode, startPoint, customDays],
  );

  const selectStop = useCallback((caseId: string | null) => {
    setSelectedCaseId(caseId);
  }, []);

  const activeDay: FieldRouteDay | null = plan.days[dayIndex] ?? null;

  const missingGeoCases = useMemo(
    () =>
      plan.missingGeoCaseIds
        .map((id) => cases.find((c) => c.id === id))
        .filter(Boolean) as CaseFile[],
    [plan.missingGeoCaseIds, cases],
  );

  const geocodeMissingCases = useCallback(async () => {
    const targets = missingGeoCases.filter((c) => c.address?.trim());
    if (targets.length === 0) return;

    setGeocoding(true);
    setGeocodeError(null);
    let ok = 0;
    let lastError: string | null = null;

    for (const c of targets) {
      try {
        const res = await fetch('/api/field-geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: c.address }),
        });
        const data = (await res.json()) as {
          lat?: number;
          lng?: number;
          error?: string;
        };
        if (res.ok && typeof data.lat === 'number' && typeof data.lng === 'number') {
          updateCase(c.id, { latitude: data.lat, longitude: data.lng });
          ok += 1;
        } else {
          lastError = data.error ?? '좌표 변환 실패';
        }
      } catch {
        lastError = '좌표 변환 요청 중 오류가 발생했습니다.';
      }
    }

    if (ok === 0 && lastError) {
      setGeocodeError(lastError);
    } else if (ok > 0 && ok < targets.length) {
      setGeocodeError(`${targets.length - ok}건은 좌표 변환에 실패했습니다.`);
    }
    setGeocoding(false);
  }, [missingGeoCases, updateCase]);

  useEffect(() => {
    if (autoGeocodeDone.current || missingGeoCases.length === 0) return;
    autoGeocodeDone.current = true;
    void geocodeMissingCases();
  }, [missingGeoCases.length, geocodeMissingCases]);

  const fetchRoute = useCallback(async (day: FieldRouteDay, mode: FieldRouteMode) => {
    const origin = startPoint ?? plan.startPoint;
    if (!origin || day.stops.length === 0) {
      setRoutePath([]);
      setRouteSummary(null);
      setRouteLegs([]);
      setRouteLoading(false);
      return;
    }

    const stopsPayload = day.stops.map((s) => ({
      caseId: s.caseId,
      lat: s.lat,
      lng: s.lng,
      name: s.name,
    }));
    const cacheKey = buildRouteCacheKey(mode, origin, stopsPayload);
    const cached = getCachedRoute(cacheKey);
    if (cached) {
      setRoutePath(cached.path);
      setRouteSummary(cached.summary);
      setRouteLegs(cached.legs);
      setRouteLoading(false);
      return;
    }

    setRouteLoading(true);
    setRoutePath([]);
    setRouteSummary(null);
    setRouteLegs([]);
    try {
      const res = await fetch('/api/field-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          mode,
          stops: stopsPayload.map(({ lat, lng, name }) => ({
            lat,
            lng,
            name,
          })),
        }),
      });
      const data = (await res.json()) as {
        path?: GeoPoint[];
        summary?: RouteSummary;
        legs?: FieldRouteLegGuide[];
        fallback?: boolean;
      };
      const routePathResult =
        Array.isArray(data.path) && data.path.length >= 2 ? data.path : [];
      const summary =
        routePathResult.length > 0 ? (data.summary ?? null) : null;
      const legs = Array.isArray(data.legs) ? data.legs : [];

      setRoutePath(routePathResult);
      setRouteSummary(summary);
      setRouteLegs(legs);

      if (routePathResult.length > 0) {
        setCachedRoute(cacheKey, {
          path: routePathResult,
          summary,
          legs,
        });
      }
    } catch {
      setRoutePath([]);
      setRouteSummary(null);
      setRouteLegs([]);
    } finally {
      setRouteLoading(false);
    }
  }, [plan.startPoint, startPoint]);

  useEffect(() => {
    if (!activeDay) {
      setRoutePath([]);
      setRouteSummary(null);
      setRouteLegs([]);
      return;
    }
    void fetchRoute(activeDay, routeMode);
  }, [activeDay, routeMode, fetchRoute]);

  useEffect(() => {
    const stops = plan.days[dayIndex]?.stops ?? [];
    const first = stops[0]?.caseId ?? null;
    setSelectedCaseId((prev) => {
      if (prev && stops.some((s) => s.caseId === prev)) return prev;
      return first;
    });
  }, [dayIndex, plan.days]);

  useEffect(() => {
    if (!selectedCaseId) return;
    const order = plan.days[dayIndex]?.stops.find(
      (s) => s.caseId === selectedCaseId,
    )?.order;
    onFocusCase?.(selectedCaseId, order);
  }, [selectedCaseId, dayIndex, plan.days, onFocusCase]);

  useEffect(() => {
    if (dayIndex >= plan.days.length) {
      setDayIndex(Math.max(0, plan.days.length - 1));
    }
  }, [dayIndex, plan.days.length]);

  function onDailyCountChange(n: number) {
    const v = clampDailyCount(n);
    setDailyCount(v);
    saveDailyCount(v);
    setDayIndex(0);
  }

  function onPackModeChange(mode: FieldPackMode) {
    if (mode === 'custom') {
      const { routable } = filterRoutableCases(cases);
      const seeded =
        customDays && customDays.some((d) => d.length > 0)
          ? reconcileCustomDays(customDays, routable, dailyCount)
          : plan.days.map((d) => d.stops.map((s) => s.caseId));
      const next =
        seeded.length > 0
          ? seeded
          : reconcileCustomDays(null, routable, dailyCount);
      setCustomDays(next);
      saveCustomDays(next);
      // 일차별 목표 건수는 하루 임장 갯수(기본 3)를 쓰고, 그날 사건 수로 덮지 않음
      const counts =
        customDayCounts.length === next.length
          ? customDayCounts
          : next.map(() => clampDailyCount(dailyCount));
      setCustomDayCounts(counts);
      saveCustomDayCounts(counts);
    }
    setPackMode(mode);
    savePackMode(mode);
    setDayIndex(0);
  }

  function onCustomDayCountChange(index: number, value: number) {
    const v = clampDailyCount(value);
    setCustomDayCounts((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push(dailyCount);
      next[index] = v;
      saveCustomDayCounts(next);
      return next;
    });
  }

  function addCustomDay() {
    setCustomDays((prev) => {
      const base = prev ?? plan.days.map((d) => d.stops.map((s) => s.caseId));
      const next = [...base, []];
      saveCustomDays(next);
      return next;
    });
    setCustomDayCounts((prev) => {
      const next = [...prev, dailyCount];
      saveCustomDayCounts(next);
      return next;
    });
  }

  function moveStop(caseId: string, fromDay: number, toDay: number) {
    const base =
      customDays ?? plan.days.map((d) => d.stops.map((s) => s.caseId));
    const next = moveCaseBetweenDays(base, caseId, fromDay, toDay);
    setCustomDays(next);
    saveCustomDays(next);
    setCustomDayCounts((counts) => {
      const aligned = next.map((_, i) =>
        clampDailyCount(counts[i] ?? dailyCount),
      );
      saveCustomDayCounts(aligned);
      return aligned;
    });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoHint('이 브라우저에서는 위치 정보를 사용할 수 없습니다.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setStartPoint(pt);
        saveStartPoint(pt.lat, pt.lng);
        setGeoHint(null);
      },
      () => {
        setGeoHint('위치 권한이 거부되었습니다. 기본 출발지(서울 시청)를 사용합니다.');
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  function onRouteModeChange(mode: FieldRouteMode) {
    setRouteMode(mode);
    saveRouteMode(mode);
  }

  const routePathLegs = useMemo(
    () =>
      activeDay
        ? resolveRoutePathLegs(routePath, routeLegs, activeDay.stops)
        : [],
    [routePath, routeLegs, activeDay],
  );

  const totalStops = plan.days.reduce((n, d) => n + d.stops.length, 0);
  const routeModeLabel = routeMode === 'car' ? '자차' : '대중교통';
  const customCountMismatch =
    packMode === 'custom' &&
    plan.days.some(
      (day, i) =>
        clampDailyCount(customDayCounts[i] ?? day.stops.length) !==
        day.stops.length,
    );

  return (
    <Section title={`${packModeTitle(packMode)} (${totalStops}건)`}>
      <div
        className="field-route-pack-tabs"
        role="tablist"
        aria-label="동선 묶는 방식"
      >
        {(
          [
            ['deadline', '마감일 우선'],
            ['region', '유사지역 우선'],
            ['custom', '직접 설정'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={packMode === mode}
            className={`field-route-pack-tab${packMode === mode ? ' active' : ''}`}
            onClick={() => onPackModeChange(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="s-note field-route-pack-hint">{packModeHint(packMode)}</p>

      <div className="field-route-controls">
        {packMode !== 'custom' ? (
          <label className="field-route-control">
            <span className="field-route-label">하루 임장 갯수</span>
            <input
              type="number"
              min={1}
              max={10}
              value={dailyCount}
              onChange={(e) => onDailyCountChange(Number(e.target.value))}
              className="field-route-count-input"
            />
          </label>
        ) : (
          <>
            <div
              className="field-route-custom-counts"
              aria-label="일차별 임장 건수"
            >
              {(customDayCounts.length > 0
                ? customDayCounts
                : plan.days.map(() => dailyCount)
              ).map((count, i) => (
                <label key={`day-count-${i}`} className="field-route-day-count-edit">
                  <span>{i + 1}일차</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={count}
                    onChange={(e) =>
                      onCustomDayCountChange(i, Number(e.target.value))
                    }
                    className="field-route-count-input"
                  />
                </label>
              ))}
              <button
                type="button"
                className="btn btn-outline btn-sm field-route-add-day"
                onClick={addCustomDay}
              >
                일차 추가
              </button>
            </div>
          </>
        )}
      </div>
      {customCountMismatch ? (
        <p className="s-note">
          설정한 일차별 건수와 배치가 다릅니다. 목록에서 사건을 다른 날로
          옮겨 맞추세요.
        </p>
      ) : null}

      {geoHint ? <p className="s-note">{geoHint}</p> : null}
      {geocoding ? (
        <p className="s-note field-route-loading">소재지 좌표 변환 중…</p>
      ) : null}
      {geocodeError ? (
        <p className="s-note" style={{ color: 'var(--seal)' }}>
          {geocodeError}
        </p>
      ) : null}

      {plan.days.length === 0 && !geocoding ? (
        <p className="s-note">
          {missingGeoCases.length > 0
            ? '아래 「소재지 좌표 변환」으로 주소를 좌표로 바꾸면 동선과 지도 핀이 표시됩니다.'
            : '임장 동선을 만들려면 입찰사건에서 법원·사건번호로 입찰 사건을 추가해 주세요.'}
        </p>
      ) : null}

      {plan.days.length > 0 ? (
        <>
          <div className="field-route-day-tabs" role="tablist">
            {plan.days.map((day) => (
              <button
                key={day.dayIndex}
                type="button"
                role="tab"
                aria-selected={day.dayIndex === dayIndex}
                className={`field-route-day-tab${day.dayIndex === dayIndex ? ' active' : ''}`}
                onClick={() => {
                  setDayIndex(day.dayIndex);
                  selectStop(day.stops[0]?.caseId ?? null);
                }}
              >
                {day.label}
                {day.regionLabel ? (
                  <span className="field-route-day-region">
                    {day.regionLabel}
                  </span>
                ) : null}
                <span className="field-route-day-count">{day.stops.length}건</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="field-route-map-toolbar">
        <div className="field-route-map-toolbar-main">
          {plan.days.length > 0 ? (
            <div
              className="field-route-mode-tabs"
              role="tablist"
              aria-label="이동 수단"
            >
              <button
                type="button"
                role="tab"
                aria-selected={routeMode === 'transit'}
                className={`field-route-mode-tab${routeMode === 'transit' ? ' active' : ''}`}
                onClick={() => onRouteModeChange('transit')}
              >
                대중교통
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={routeMode === 'car'}
                className={`field-route-mode-tab${routeMode === 'car' ? ' active' : ''}`}
                onClick={() => onRouteModeChange('car')}
              >
                자차
              </button>
            </div>
          ) : null}
          {plan.days.length > 0 && routeLoading ? (
            <span className="field-route-summary field-route-summary-inline">
              {routeModeLabel} 경로 계산 중…
            </span>
          ) : routeSummary ? (
            <span className="field-route-summary field-route-summary-inline">
              {routeModeLabel} 예상 {routeSummary.durationLabel} ·{' '}
              {routeSummary.distanceLabel}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={useMyLocation}
        >
          현재 위치를 출발지로
        </button>
      </div>
      <div className="field-route-map-wrap">
        <KakaoRouteMap
          start={startPoint ?? plan.startPoint}
          stops={activeDay?.stops ?? []}
          path={routePath}
          pathLegs={routePathLegs}
          pathLoading={routeLoading}
          selectedCaseId={selectedCaseId}
          onSelectStop={(id) => selectStop(id)}
        />
      </div>

      <FieldRouteGuide
        mode={routeMode}
        legs={routeLegs}
        stops={activeDay?.stops ?? []}
        selectedCaseId={selectedCaseId}
        loading={routeLoading}
      />

      {(activeDay?.stops ?? []).map((stop) => (
        <div className="result-row route-row" key={stop.caseId}>
          <span className="route-row-main">
            <span
              className={`route-pin field-route-stop-pin${stop.caseId === selectedCaseId ? ' is-active' : ''}`}
              aria-hidden="true"
            >
              {stop.order}
            </span>
            <span>
              <button
                type="button"
                className="btn-text field-route-stop-link"
                onClick={() => selectStop(stop.caseId)}
              >
                <strong>{stop.name}</strong>
              </button>
              <span className="route-case-meta">{stop.caseNumber}</span>
            </span>
          </span>
          <span className="route-row-actions">
            {stop.address ? (
              <a
                href={mapSearchUrl(stop.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-text"
              >
                지도
              </a>
            ) : null}
            <span style={{ fontFamily: 'var(--mono)' }}>
              마감 {formatAuctionDateShort(stop.auctionDate)}
            </span>
            {packMode === 'custom' ? (
              <span className="field-route-move">
                <button
                  type="button"
                  className="btn-text"
                  disabled={dayIndex <= 0}
                  onClick={() => moveStop(stop.caseId, dayIndex, dayIndex - 1)}
                >
                  ← 전날
                </button>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => moveStop(stop.caseId, dayIndex, dayIndex + 1)}
                >
                  다음날 →
                </button>
              </span>
            ) : null}
          </span>
        </div>
      ))}

      {missingGeoCases.length > 0 ? (
        <div className="banner banner-soft" style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 8px' }}>
            좌표 없음 {missingGeoCases.length}건 — 주소는 있지만 지도 좌표가
            저장되지 않았습니다. (키 추가 전 등록한 사건이면 자동 변환을
            시도합니다.)
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={geocoding}
            onClick={() => void geocodeMissingCases()}
          >
            {geocoding ? '좌표 변환 중…' : '소재지 좌표 변환'}
          </button>
          <ul className="field-route-missing-list">
            {missingGeoCases.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}
