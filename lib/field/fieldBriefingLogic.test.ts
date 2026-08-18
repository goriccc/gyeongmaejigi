import { describe, expect, it } from 'vitest';
import { inferPreferredDong } from '@/lib/field/preferredDong';
import { namesLikelyMatch, tradeNameInAddress } from '@/lib/field/complexName';
import {
  inferPropTypeFromLedger,
  isComplexLike,
  liquidityKindFor,
} from '@/lib/field/complexLike';
import { isRetryableDataGoKrError } from '@/lib/field/dataGoKr';

describe('inferPreferredDong', () => {
  it('동이 갈리고 한쪽이 3건 이상이면 가설', () => {
    const r = inferPreferredDong([
      { dong: '101동' },
      { dong: '101동' },
      { dong: '101동' },
      { dong: '102동' },
    ]);
    expect(r?.dong).toBe('101동');
  });

  it('표본이 한 동만이면 가설 없음', () => {
    expect(
      inferPreferredDong([{ dong: '101동' }, { dong: '101동' }, { dong: '101동' }]),
    ).toBeNull();
  });
});

describe('complex matching', () => {
  it('단지명 공백·접미 차이를 허용', () => {
    expect(namesLikelyMatch('래미안대치팰리스1단지', '래미안 대치팰리스 1단지')).toBe(
      true,
    );
  });

  it('소재지 문자열에 단지명이 포함되면 매칭', () => {
    expect(
      tradeNameInAddress(
        '래미안대치팰리스',
        '서울특별시 강남구 대치동 952 래미안대치팰리스',
      ),
    ).toBe(true);
  });

  it('아파트는 항상 단지형', () => {
    expect(
      isComplexLike({
        propType: '아파트',
        name: '단독',
        uniqueDongs: 0,
        titleBuildings: 1,
      }),
    ).toBe(true);
    expect(
      liquidityKindFor('다세대', false),
    ).toBeNull();
  });
});

describe('inferPropTypeFromLedger', () => {
  it('공동주택+다세대주택은 다세대로 본다', () => {
    expect(
      inferPropTypeFromLedger(
        [{ mainPurpsCdNm: '공동주택', etcPurps: '다세대주택' }],
        '아파트',
      ),
    ).toBe('다세대');
  });

  it('표제부가 없으면 기본값을 유지한다', () => {
    expect(inferPropTypeFromLedger([], '아파트')).toBe('아파트');
  });
});

describe('isRetryableDataGoKrError', () => {
  it('건축HUB 503·연결실패만 재시도한다', () => {
    expect(isRetryableDataGoKrError('http-503')).toBe(true);
    expect(isRetryableDataGoKrError('서비스 연결실패')).toBe(true);
    expect(isRetryableDataGoKrError('missing-key')).toBe(false);
    expect(isRetryableDataGoKrError('NODATA_ERROR')).toBe(false);
  });
});
