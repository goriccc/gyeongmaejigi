import { NextResponse } from 'next/server';
import {
  fetchKakaoDrivingRoute,
  fetchKakaoTransitRoute,
  formatRouteDistance,
  formatRouteDuration,
} from '@/lib/field/kakaoNavi';
import type {
  FieldRouteApiStop,
  FieldRouteMode,
  GeoPoint,
} from '@/lib/field/types';

export const runtime = 'nodejs';

type Body = {
  origin?: GeoPoint;
  stops?: FieldRouteApiStop[];
  mode?: FieldRouteMode;
};

function isPoint(p: unknown): p is GeoPoint {
  if (!p || typeof p !== 'object') return false;
  const o = p as GeoPoint;
  return (
    typeof o.lat === 'number' &&
    typeof o.lng === 'number' &&
    Number.isFinite(o.lat) &&
    Number.isFinite(o.lng)
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const origin = body.origin;
    const stops = body.stops ?? [];

    if (!isPoint(origin)) {
      return NextResponse.json(
        { error: '출발지 좌표가 필요합니다.' },
        { status: 400 },
      );
    }

    const validStops = stops.filter(
      (s) =>
        typeof s.lat === 'number' &&
        typeof s.lng === 'number' &&
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng),
    );

    const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        path: [],
        distanceM: 0,
        durationSec: 0,
        fallback: true,
        summary: null,
        legs: [],
      });
    }

    const mode: FieldRouteMode = body.mode === 'transit' ? 'transit' : 'car';
    const result =
      mode === 'transit'
        ? await fetchKakaoTransitRoute(apiKey, origin, validStops)
        : await fetchKakaoDrivingRoute(apiKey, origin, validStops);

    return NextResponse.json({
      ...result,
      summary: result.fallback
        ? null
        : {
            distanceLabel: formatRouteDistance(result.distanceM),
            durationLabel: formatRouteDuration(result.durationSec),
          },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '경로 조회 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
