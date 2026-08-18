import { NextResponse } from 'next/server';
import { assembleFieldBriefing } from '@/lib/field/assembleFieldBriefing';
import type { FieldBriefingInput } from '@/types/case';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { caseFile?: FieldBriefingInput };
    const c = body.caseFile;
    if (!c?.address?.trim()) {
      return NextResponse.json({ error: '소재지가 필요합니다.' }, { status: 400 });
    }

    const briefing = await assembleFieldBriefing(c);
    return NextResponse.json({ briefing });
  } catch (e) {
    const message = e instanceof Error ? e.message : '브리핑 조회 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
