import { describe, expect, it } from 'vitest';
import { geocodeQueryCandidates } from '@/lib/auction/geocode';

describe('geocodeQueryCandidates', () => {
  it('동·호·단지명을 제거한 지번 후보를 만든다', () => {
    expect(
      geocodeQueryCandidates(
        '서울특별시 관악구 봉천동 1728 관악파크푸르지오 104동 3층304호',
      ),
    ).toEqual([
      '서울특별시 관악구 봉천동 1728 관악파크푸르지오 104동 3층304호',
      '서울특별시 관악구 봉천동 1728',
    ]);
    expect(
      geocodeQueryCandidates(
        '서울특별시 강남구 도곡동 467-17 타워팰리스 에프동 14층1407호',
      ),
    ).toEqual([
      '서울특별시 강남구 도곡동 467-17 타워팰리스 에프동 14층1407호',
      '서울특별시 강남구 도곡동 467-17',
    ]);
  });
});
