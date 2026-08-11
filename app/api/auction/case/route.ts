import { NextResponse } from 'next/server';
import {
  getCourtAuctionClient,
  normalizeCaseNumber,
} from '@/lib/auction/courtAuctionClient';
import { geocodeAddress } from '@/lib/auction/geocode';
import { mapCourtAuctionCase } from '@/lib/auction/mapCaseLookup';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      courtCode?: string;
      caseNumber?: string;
      courtName?: string;
    };

    const courtCode = body.courtCode?.trim() ?? '';
    const caseNumber = normalizeCaseNumber(body.caseNumber ?? '');

    if (!/^B\d{6}$/.test(courtCode)) {
      return NextResponse.json(
        { error: '법원을 선택해 주세요.' },
        { status: 400 },
      );
    }
    if (!caseNumber) {
      return NextResponse.json(
        { error: '사건번호를 입력해 주세요.' },
        { status: 400 },
      );
    }

    const raw = await getCourtAuctionClient().getCaseByCaseNumber(
      courtCode,
      caseNumber,
    );

    if (!raw.found) {
      return NextResponse.json(
        {
          found: false,
          error:
            '사건을 찾지 못했습니다. 법원과 사건번호(예: 2026타경1234)를 확인해 주세요.',
        },
        { status: 404 },
      );
    }

    const mapped = mapCourtAuctionCase(
      raw,
      courtCode,
      body.courtName,
      body.caseNumber,
    );

    if (!mapped) {
      return NextResponse.json(
        { found: false, error: '사건 정보를 해석하지 못했습니다.' },
        { status: 422 },
      );
    }

    let latitude: number | undefined;
    let longitude: number | undefined;
    if (mapped.address) {
      try {
        const geo = await geocodeAddress(mapped.address);
        if (geo) {
          latitude = geo.lat;
          longitude = geo.lng;
        }
      } catch {
        // 지오코딩 실패는 사건 생성을 막지 않음
      }
    }

    return NextResponse.json({
      found: true,
      ...mapped,
      latitude,
      longitude,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '경매 사건 조회에 실패했습니다.';
    const blocked =
      (err as Error & { code?: string }).code === 'BLOCKED' ||
      /차단|ipcheck/i.test(message);
    return NextResponse.json(
      { found: false, error: message },
      { status: blocked ? 503 : 502 },
    );
  }
}
