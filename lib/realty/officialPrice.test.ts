import { describe, expect, it } from 'vitest';
import {
  parseUnitFromAddress,
  pnuCandidatesFromGeo,
  pnuFromGeo,
} from '@/lib/realty/officialPrice';

describe('parseUnitFromAddress', () => {
  it('아파트 동·층·호', () => {
    expect(
      parseUnitFromAddress('서울특별시 관악구 봉천동 1728 관악파크푸르지오 104동 3층304호'),
    ).toEqual({ dong: '104', ho: '304' });
  });

  it('제N동 제N층 제N호 표기', () => {
    expect(
      parseUnitFromAddress('서울특별시 강남구 대치동 316 은마아파트 제2동 제6층 제607호'),
    ).toEqual({ dong: '2', ho: '607' });
  });

  it('빌라는 동 없이 호만', () => {
    expect(
      parseUnitFromAddress('서울특별시 양천구 목동 324-80 그랜드빌 6층 602호'),
    ).toEqual({ dong: null, ho: '602' });
  });

  it('법정동 이름은 동으로 잡지 않음', () => {
    expect(parseUnitFromAddress('서울특별시 관악구 봉천동 1598-12')).toEqual({
      dong: null,
      ho: null,
    });
  });

  it('가동·B동 같은 문자 동', () => {
    expect(parseUnitFromAddress('경기도 수원시 팔달구 인계동 1029-10 가동 2층 201호')).toEqual({
      dong: '가',
      ho: '201',
    });
    expect(parseUnitFromAddress('서울특별시 마포구 연남동 239-49 B동 제3층 제302호')).toEqual({
      dong: 'B',
      ho: '302',
    });
  });
});

describe('pnuFromGeo', () => {
  it('일반 지번', () => {
    expect(
      pnuFromGeo({ lat: 0, lng: 0, bCode: '1147010200', bun: '324', ji: '80' }),
    ).toBe('1147010200103240080');
  });

  it('부번 없음·산 지번', () => {
    expect(
      pnuFromGeo({ lat: 0, lng: 0, bCode: '1168010600', bun: '316', ji: '', mountain: true }),
    ).toBe('1168010600203160000');
  });

  it('본번 없으면 null', () => {
    expect(pnuFromGeo({ lat: 0, lng: 0, bCode: '1168010600' })).toBeNull();
  });
});

describe('pnuCandidatesFromGeo', () => {
  it('인천 서해구 청라동 → 옛 서구 청라동 코드 추가', () => {
    expect(
      pnuCandidatesFromGeo({
        lat: 0,
        lng: 0,
        bCode: '2827511100',
        bun: '115',
        ji: '1',
        emdName: '청라동',
      }),
    ).toEqual(['2827511100101150001', '2826012200101150001']);
  });

  it('화성 만세구 남양읍 남양리 → 옛 화성시 리 코드', () => {
    expect(
      pnuCandidatesFromGeo({
        lat: 0,
        lng: 0,
        bCode: '4159125621',
        bun: '1',
        emdName: '남양읍 남양리',
      }),
    ).toEqual(['4159125621100010000', '4159026221100010000']);
  });

  it('개편 대상이 아니면 현재 PNU만', () => {
    expect(
      pnuCandidatesFromGeo({
        lat: 0,
        lng: 0,
        bCode: '1147010200',
        bun: '324',
        ji: '80',
        emdName: '목동',
      }),
    ).toEqual(['1147010200103240080']);
  });
});
