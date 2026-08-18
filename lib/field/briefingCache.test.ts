import { describe, expect, it } from 'vitest';
import { briefingNeedsRefetch, BRIEFING_SCHEMA_VERSION } from '@/lib/field/briefingCache';
import type { FieldBriefingSnapshot } from '@/types/case';

function snap(
  patch: Partial<FieldBriefingSnapshot> = {},
): FieldBriefingSnapshot {
  return {
    fetchedAt: '2026-08-18T00:00:00.000Z',
    schemaVersion: BRIEFING_SCHEMA_VERSION,
    propType: '아파트',
    ...patch,
  };
}

describe('briefingNeedsRefetch', () => {
  it('refetches missing or outdated snapshots', () => {
    expect(briefingNeedsRefetch(undefined)).toBe(true);
    expect(briefingNeedsRefetch(snap({ schemaVersion: 9 }))).toBe(true);
    expect(briefingNeedsRefetch(snap())).toBe(false);
  });

  it('refetches when config keys were missing', () => {
    expect(
      briefingNeedsRefetch(
        snap({ warnings: ['KAKAO_REST_API_KEY를 확인하세요.'] }),
      ),
    ).toBe(true);
    expect(
      briefingNeedsRefetch(
        snap({ warnings: ['같은 단지·유사 면적 실거래를 찾지 못했습니다.'] }),
      ),
    ).toBe(false);
  });
});
