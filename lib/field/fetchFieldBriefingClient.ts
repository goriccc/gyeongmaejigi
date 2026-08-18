import type { FieldBriefingInput, FieldBriefingSnapshot } from '@/types/case';

export async function fetchFieldBriefingClient(
  caseFile: FieldBriefingInput,
  signal?: AbortSignal,
): Promise<FieldBriefingSnapshot> {
  const res = await fetch('/api/field-briefing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ caseFile }),
    signal: signal ?? AbortSignal.timeout(90_000),
  });
  const data = (await res.json()) as {
    briefing?: FieldBriefingSnapshot;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || '브리핑 조회 실패');
  if (!data.briefing) throw new Error('브리핑 데이터가 비어 있습니다.');
  return data.briefing;
}
