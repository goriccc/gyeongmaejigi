import { NextResponse } from 'next/server';
import { resolveOfficialPrice } from '@/lib/realty/officialPrice';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get('address')?.trim() ?? '';
  if (!address) {
    return NextResponse.json(
      { ok: false, error: '사건 소재지가 없습니다.' },
      { status: 400 },
    );
  }
  try {
    const result = await resolveOfficialPrice(address);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : '공시가격 조회에 실패했습니다.',
      },
      { status: 502 },
    );
  }
}
