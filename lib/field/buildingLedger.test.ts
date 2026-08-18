import { describe, expect, it } from 'vitest';
import {
  dongHintFromAddress,
  normalizeUseAprDay,
  pickRecapUseApr,
  pickTitleUseApr,
  type BuildingTitle,
} from '@/lib/field/buildingLedger';

function title(patch: Partial<BuildingTitle>): BuildingTitle {
  return {
    useAprYear: null,
    useAprDay: null,
    dongName: null,
    buildingName: null,
    hhldCnt: null,
    hoCnt: null,
    mainAtchGbCd: '0',
    mainAtchGbCdNm: '주건축물',
    mainPurpsCdNm: '공동주택',
    etcPurps: '아파트',
    ...patch,
  };
}

describe('normalizeUseAprDay', () => {
  it('YYYYMMDD와 구분 기호가 있는 날짜를 정규화한다', () => {
    expect(normalizeUseAprDay('19790531')).toBe('19790531');
    expect(normalizeUseAprDay('1979-5-31')).toBe('19790531');
    expect(normalizeUseAprDay('1979년 5월 31일')).toBe('19790531');
  });
});

describe('dongHintFromAddress', () => {
  it('아파트 동 번호를 법정동과 구분한다', () => {
    expect(
      dongHintFromAddress(
        '서울특별시 강남구 삼성로 212, 31동 14층1401호 (개포동,은마아파트)',
      ),
    ).toBe('31동');
    expect(
      dongHintFromAddress(
        '서울특별시 관악구 봉천동 1728 관악파크푸르지오 104동 3층304호',
      ),
    ).toBe('104동');
    expect(
      dongHintFromAddress(
        '서울특별시 은평구 연서로11길 20-21, 2층 가호',
      ),
    ).toBeNull();
    expect(
      dongHintFromAddress(
        '서울특별시 중구 신당동 366-126 남산정은스카이아파트 7층704호',
      ),
    ).toBeNull();
  });
});

describe('pickTitleUseApr', () => {
  it('소재지 동의 사용승인일을 고른다', () => {
    expect(
      pickTitleUseApr(
        [
          title({ dongName: '21동', useAprYear: 1979, useAprDay: '19790512' }),
          title({ dongName: '31동', useAprYear: 1980, useAprDay: '19800315' }),
        ],
        '31동',
      ),
    ).toEqual({ useAprYear: 1980, useAprDay: '19800315' });
  });
});

describe('pickRecapUseApr', () => {
  it('총괄표제부에서 연월일이 더 긴 사용승인일을 고른다', () => {
    expect(
      pickRecapUseApr([
        {
          pk: 'a',
          bldNm: '은마아파트',
          hhldCnt: 4402,
          mainBldCnt: 31,
          useAprDay: '1979',
        },
        {
          pk: 'b',
          bldNm: '은마아파트',
          hhldCnt: 4402,
          mainBldCnt: 31,
          useAprDay: '19790531',
        },
      ]),
    ).toBe('19790531');
  });
});
