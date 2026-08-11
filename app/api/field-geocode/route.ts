import { NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/auction/geocode';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { address?: string };
    const address = body.address?.trim() ?? '';

    if (!address) {
      return NextResponse.json(
        { error: '주소가 필요합니다.' },
        { status: 400 },
      );
    }

    if (!process.env.KAKAO_REST_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            'KAKAO_REST_API_KEY가 설정되지 않았습니다. .env.local 확인 후 dev 서버를 재시작해 주세요.',
        },
        { status: 503 },
      );
    }

    const point = await geocodeAddress(address);
    if (!point) {
      return NextResponse.json(
        {
          error:
            '주소를 좌표로 변환하지 못했습니다. 소재지 문구를 확인하거나 입찰사건에서 정보를 다시 불러와 주세요.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ lat: point.lat, lng: point.lng });
  } catch (e) {
    const message = e instanceof Error ? e.message : '지오코딩 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
