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

  it('도로명 주소는 건물번호까지 후보로 만든다', () => {
    expect(
      geocodeQueryCandidates(
        '서울특별시 양천구 목동중앙남로16다길 46-10, 제6층 제601호 (목동, 그랜드빌)',
      ),
    ).toEqual([
      '서울특별시 양천구 목동중앙남로16다길 46-10, 제6층 제601호 (목동, 그랜드빌)',
      '서울특별시 양천구 목동중앙남로16다길 46-10',
    ]);
    expect(
      geocodeQueryCandidates('서울특별시 종로구 종로1가 1 교보빌딩 3층 301호'),
    ).toEqual([
      '서울특별시 종로구 종로1가 1 교보빌딩 3층 301호',
    ]);
  });
});
