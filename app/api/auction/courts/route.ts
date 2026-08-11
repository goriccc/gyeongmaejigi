import { NextResponse } from 'next/server';
import { getCourtAuctionClient } from '@/lib/auction/courtAuctionClient';
import { formatCourtLabel } from '@/lib/auction/caseNumberFormat';
import { sortCourtList } from '@/lib/auction/courtSort';

export const runtime = 'nodejs';

let cached:
  | {
      version: number;
      at: number;
      items: Array<{ code: string; label: string }>;
    }
  | null = null;

const CACHE_MS = 1000 * 60 * 60 * 24;
const CACHE_VERSION = 3;

export async function GET() {
  try {
    if (
      cached &&
      cached.version === CACHE_VERSION &&
      Date.now() - cached.at < CACHE_MS
    ) {
      return NextResponse.json({ items: cached.items });
    }

    const courts = await getCourtAuctionClient().getCourtCodes();
    const items = sortCourtList(
      courts.map((c) => ({
        code: c.code,
        label: formatCourtLabel(c.name, c.branchName),
      })),
    );

    cached = { version: CACHE_VERSION, at: Date.now(), items };
    return NextResponse.json({ items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '법원 목록을 불러오지 못했습니다.';
    const blocked =
      (err as Error & { code?: string }).code === 'BLOCKED' ||
      /차단|ipcheck/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: blocked ? 503 : 502 },
    );
  }
}
