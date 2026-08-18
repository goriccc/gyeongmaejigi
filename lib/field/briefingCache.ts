import type { FieldBriefingSnapshot } from '@/types/case';

export const BRIEFING_SCHEMA_VERSION = 12;

const CONFIG_WARNING_MARKERS = [
  'DATA_GO_KR_SERVICE_KEY',
  'KAKAO_REST_API_KEY',
  '공공데이터 인증키가 없어',
] as const;

export function briefingNeedsRefetch(
  b: FieldBriefingSnapshot | undefined,
): boolean {
  if (!b) return true;
  if ((b.schemaVersion ?? 1) < BRIEFING_SCHEMA_VERSION) return true;
  const warnings = b.warnings ?? [];
  return CONFIG_WARNING_MARKERS.some((marker) =>
    warnings.some((w) => w.includes(marker)),
  );
}
