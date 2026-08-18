import { describe, expect, it } from 'vitest';
import {
  canonicalNamesEqual,
  pickCanonicalComplexName,
  pickBaseComplexName,
  resolveOfficialComplexName,
  addressDeclaresComplex,
  isLikelyAddressLine,
  sameComplexBuildingName,
} from '@/lib/field/complexName';
import {
  aggregatePlatRecaps,
  aggregateRecapTotals,
  aggregateRecapTotalsByPlat,
  collectPlatKeys,
  countResidentialDongs,
  pickLargerComplexScale,
  preferComplexWideScale,
  aggregateNamedRecaps,
  reconcileHouseholdCount,
  shouldExpandComplexPlats,
  scaleFromSeedTitles,
} from '@/lib/field/complexScale';
import type { PlatKey } from '@/lib/field/buildingLedger';
import { titleHouseholdCount } from '@/lib/field/buildingLedger';

describe('canonicalNamesEqual', () => {
  it('공백만 무시하고 1차·2차는 구분', () => {
    expect(canonicalNamesEqual('래미안 대치팰리스1차', '래미안대치팰리스1차')).toBe(
      true,
    );
    expect(canonicalNamesEqual('래미안대치팰리스1차', '래미안대치팰리스2차')).toBe(
      false,
    );
  });
});

describe('sameComplexBuildingName', () => {
  it('아파트 접미사만 무시하고 차수는 구분', () => {
    expect(sameComplexBuildingName('은마아파트 31동', '은마아파트')).toBe(true);
    expect(sameComplexBuildingName('은마아파트31동', '은마')).toBe(true);
    expect(sameComplexBuildingName('은마아파트', '은마아파트')).toBe(true);
    expect(sameComplexBuildingName('은마아파트(22동)', '은마아파트')).toBe(true);
    expect(sameComplexBuildingName('은마아파트(31동)', '은마')).toBe(true);
    expect(sameComplexBuildingName('타워팰리스', '타워팰리스2차')).toBe(false);
    expect(sameComplexBuildingName('힐스테이트', '힐스테이트 강남')).toBe(false);
  });
});

describe('pickCanonicalComplexName', () => {
  it('가장 많이 등장하는 표기를 선택', () => {
    expect(
      pickCanonicalComplexName([
        '힐스테이트',
        '힐스테이트',
        '힐스테이트 강남',
        '다른단지',
      ]),
    ).toBe('힐스테이트');
  });

  it('공동주택 등 일반 명칭은 제외', () => {
    expect(
      pickCanonicalComplexName(['공동주택', '공동주택', '래미안대치팰리스']),
    ).toBe('래미안대치팰리스');
  });
});

describe('pickBaseComplexName', () => {
  it('동번호가 붙은 대장명에서 기본 단지명을 고른다', () => {
    expect(
      pickBaseComplexName(['은마아파트(31동)', '은마아파트21동', '은마아파트(22동)']),
    ).toBe('은마아파트');
  });
});

describe('resolveOfficialComplexName', () => {
  it('주소 괄호 안 단지명을 우선한다', () => {
    expect(
      resolveOfficialComplexName({
        ledgerNames: ['은마아파트(31동)'],
        tradeNames: [],
        address:
          '서울특별시 강남구 삼성로 212, 31동 14층1401호 (개포동,은마아파트)',
      }),
    ).toBe('은마아파트');
  });

  it('전체 소재지 문자열은 단지명으로 쓰지 않는다', () => {
    expect(
      isLikelyAddressLine(
        '서울특별시 관악구 봉천동 1728 관악파크푸르지오 104동 3층304호',
      ),
    ).toBe(true);
    expect(
      resolveOfficialComplexName({
        ledgerNames: ['관악파크푸르지오'],
        tradeNames: [],
        address: '서울특별시 관악구 봉천동 1728 관악파크푸르지오 104동 3층304호',
      }),
    ).toBe('관악파크푸르지오');
  });
});

describe('addressDeclaresComplex', () => {
  it('괄호 단지명 주소만 시군구 fallback 대상', () => {
    expect(
      addressDeclaresComplex(
        '서울특별시 강남구 삼성로 212 (개포동,은마아파트)',
        '은마아파트',
      ),
    ).toBe(true);
    expect(
      addressDeclaresComplex(
        '서울특별시 관악구 봉천동 1728 관악파크푸르지오 104동 3층304호',
        '관악파크푸르지오',
      ),
    ).toBe(false);
  });
});

describe('aggregateRecapTotals', () => {
  it('동일 PK는 한 번만 합산', () => {
    const totals = aggregateRecapTotals(
      [
        { pk: 'A', bldNm: '힐스테이트', hhldCnt: 2000, mainBldCnt: 10 },
        { pk: 'A', bldNm: '힐스테이트', hhldCnt: 2000, mainBldCnt: 10 },
        { pk: 'B', bldNm: '힐스테이트', hhldCnt: 1500, mainBldCnt: 8 },
      ],
      '힐스테이트',
    );
    expect(totals.householdCount).toBe(3500);
    expect(totals.buildingCount).toBe(18);
  });

  it('다른 단지명은 제외', () => {
    const totals = aggregateRecapTotals(
      [
        { pk: 'A', bldNm: '힐스테이트1차', hhldCnt: 1000, mainBldCnt: 5 },
        { pk: 'B', bldNm: '힐스테이트2차', hhldCnt: 800, mainBldCnt: 4 },
      ],
      '힐스테이트1차',
    );
    expect(totals.householdCount).toBe(1000);
    expect(totals.buildingCount).toBe(5);
  });

  it('단지명 없는 인근 필지 recap은 합산하지 않음', () => {
    const totals = aggregateRecapTotalsByPlat(
      [
        {
          platKey: '11140-10200-0-0366-0126',
          recaps: [
            {
              pk: 'A',
              bldNm: '남산정은스카이아파트',
              hhldCnt: 102,
              mainBldCnt: 1,
            },
          ],
        },
        {
          platKey: '11140-10200-0-0366-0127',
          recaps: [{ pk: 'B', bldNm: null, hhldCnt: 43, mainBldCnt: 1 }],
        },
      ],
      '11140-10200-0-0366-0126',
      '남산정은스카이아파트',
    );
    expect(totals.householdCount).toBe(102);
    expect(totals.buildingCount).toBe(1);
  });

  it('시드 필지에만 단지명 없는 recap 허용', () => {
    expect(
      aggregatePlatRecaps(
        [{ pk: 'A', bldNm: null, hhldCnt: 102, mainBldCnt: 1 }],
        '남산정은스카이아파트',
        { allowUnnamed: true },
      ).householdCount,
    ).toBe(102);
    expect(
      aggregatePlatRecaps(
        [{ pk: 'A', bldNm: null, hhldCnt: 102, mainBldCnt: 1 }],
        '남산정은스카이아파트',
        { allowUnnamed: false },
      ).householdCount,
    ).toBe(0);
  });

  it('총괄표제부·표제부 불일치 시 표제부 우선', () => {
    expect(reconcileHouseholdCount(145, 102)).toBe(102);
    expect(reconcileHouseholdCount(102, 145)).toBe(145);
    expect(reconcileHouseholdCount(500, 0)).toBe(500);
    expect(reconcileHouseholdCount(0, 102)).toBe(102);
  });

  it('표제부 hoCnt fallback으로 총괄 145 보정', () => {
    const titles = [
      {
        useAprYear: 2005,
        dongName: null,
        buildingName: '남산정은스카이아파트',
        hhldCnt: null,
        hoCnt: 102,
        mainAtchGbCd: '0',
        mainAtchGbCdNm: '주건축물',
        mainPurpsCdNm: '공동주택',
        etcPurps: '아파트',
      },
    ];
    const recap = aggregatePlatRecaps(
      [
        {
          pk: 'A',
          bldNm: '남산정은스카이아파트',
          hhldCnt: 145,
          mainBldCnt: 1,
        },
      ],
      '남산정은스카이아파트',
      { allowUnnamed: true },
    );
    expect(recap.householdCount).toBe(145);
    const titleSum = titles.reduce((s, t) => s + titleHouseholdCount(t), 0);
    expect(titleSum).toBe(102);
    expect(reconcileHouseholdCount(recap.householdCount, titleSum)).toBe(102);
  });

  it('단지명 약칭·정식명 매칭 후 표제부 세대 수', () => {
    const totals = aggregatePlatRecaps(
      [
        {
          pk: 'A',
          bldNm: '남산정은스카이아파트',
          hhldCnt: 145,
          mainBldCnt: 1,
        },
      ],
      '남산정은스카이',
      { allowUnnamed: true },
    );
    expect(totals.householdCount).toBe(145);
    expect(reconcileHouseholdCount(totals.householdCount, 102)).toBe(102);
  });
});

describe('countResidentialDongs', () => {
  it('세대가 있는 숫자+동만 집계', () => {
    const n = countResidentialDongs(
      [
        {
          useAprYear: 2008,
          dongName: '101동',
          buildingName: '관악파크푸르지오',
          hhldCnt: 95,
          hoCnt: null,
          mainAtchGbCd: '0',
          mainAtchGbCdNm: '주건축물',
          mainPurpsCdNm: '공동주택',
          etcPurps: '아파트',
        },
        {
          useAprYear: 2008,
          dongName: '관리동',
          buildingName: '관악파크푸르지오',
          hhldCnt: null,
          hoCnt: null,
          mainAtchGbCd: '0',
          mainAtchGbCdNm: '주건축물',
          mainPurpsCdNm: '부속',
          etcPurps: null,
        },
        {
          useAprYear: 2008,
          dongName: '102동',
          buildingName: '관악파크푸르지오',
          hhldCnt: 82,
          hoCnt: null,
          mainAtchGbCd: '0',
          mainAtchGbCdNm: '주건축물',
          mainPurpsCdNm: '공동주택',
          etcPurps: '아파트',
        },
      ],
      '관악파크푸르지오',
    );
    expect(n).toBe(2);
    expect(
      countResidentialDongs(
        [
          {
            useAprYear: 2003,
            dongName: '에프동',
            buildingName: '타워팰리스',
            hhldCnt: 450,
            hoCnt: null,
            mainAtchGbCd: '0',
            mainAtchGbCdNm: '주건축물',
            mainPurpsCdNm: '공동주택',
            etcPurps: '아파트',
          },
          {
            useAprYear: 2003,
            dongName: '이동',
            buildingName: '타워팰리스',
            hhldCnt: 363,
            hoCnt: null,
            mainAtchGbCd: '0',
            mainAtchGbCdNm: '주건축물',
            mainPurpsCdNm: '공동주택',
            etcPurps: '아파트',
          },
          {
            useAprYear: 2003,
            dongName: '상가동',
            buildingName: '타워팰리스',
            hhldCnt: null,
            hoCnt: 1,
            mainAtchGbCd: '0',
            mainAtchGbCdNm: '주건축물',
            mainPurpsCdNm: '제1종근린생활시설',
            etcPurps: null,
          },
        ],
        '타워팰리스',
      ),
    ).toBe(2);
  });

  it('동 접미사 없는 숫자 동명도 집계', () => {
    expect(
      countResidentialDongs(
        [
          {
            useAprYear: 1979,
            dongName: '31',
            buildingName: '은마아파트',
            hhldCnt: 140,
            hoCnt: null,
            mainAtchGbCd: '0',
            mainAtchGbCdNm: '주건축물',
            mainPurpsCdNm: '공동주택',
            etcPurps: '아파트',
          },
          {
            useAprYear: 1979,
            dongName: '32',
            buildingName: '은마아파트',
            hhldCnt: 140,
            hoCnt: null,
            mainAtchGbCd: '0',
            mainAtchGbCdNm: '주건축물',
            mainPurpsCdNm: '공동주택',
            etcPurps: '아파트',
          },
        ],
        '은마아파트',
      ),
    ).toBe(2);
  });
});

describe('shouldExpandComplexPlats', () => {
  it('한 동만 있으면 단지 전체로 확장', () => {
    expect(
      shouldExpandComplexPlats({ householdCount: 32, buildingCount: 1 }),
    ).toBe(true);
    expect(
      shouldExpandComplexPlats({ householdCount: 0, buildingCount: 0 }),
    ).toBe(true);
    expect(
      shouldExpandComplexPlats({ householdCount: 363, buildingCount: 7 }),
    ).toBe(false);
  });
});

describe('pickLargerComplexScale', () => {
  it('은마처럼 한 동 결과보다 단지 전체 합을 택한다', () => {
    expect(
      pickLargerComplexScale(
        { householdCount: 32, buildingCount: 1 },
        { householdCount: 4424, buildingCount: 28 },
      ),
    ).toEqual({ householdCount: 4424, buildingCount: 28 });
  });

  it('한 동 호수는 단지 규모로 덮지 않는다', () => {
    expect(
      pickLargerComplexScale(
        { householdCount: 32, buildingCount: 1 },
        { householdCount: 140, buildingCount: 1 },
      ),
    ).toEqual({ householdCount: 32, buildingCount: 1 });
  });
});

describe('preferComplexWideScale', () => {
  it('총괄이 다동이면 한 동 표제부보다 총괄을 쓴다', () => {
    expect(
      preferComplexWideScale(
        { householdCount: 4424, buildingCount: 28 },
        { householdCount: 140, buildingCount: 1 },
      ),
    ).toEqual({ householdCount: 4424, buildingCount: 28 });
  });
});

describe('aggregateNamedRecaps', () => {
  it('대단지 총괄이 있으면 동별 합산 대신 그 값을 쓴다', () => {
    expect(
      aggregateNamedRecaps([
        { pk: 'A', bldNm: '은마아파트', hhldCnt: 140, mainBldCnt: 1 },
        { pk: 'B', bldNm: '은마아파트', hhldCnt: 4424, mainBldCnt: 28 },
      ]),
    ).toEqual({ householdCount: 4424, buildingCount: 28 });
  });

  it('동별 총괄만 있으면 합산한다', () => {
    expect(
      aggregateNamedRecaps([
        { pk: 'A', bldNm: '은마아파트', hhldCnt: 140, mainBldCnt: 1 },
        { pk: 'C', bldNm: '은마아파트', hhldCnt: 158, mainBldCnt: 1 },
      ]),
    ).toEqual({ householdCount: 298, buildingCount: 2 });
  });
});

describe('collectPlatKeys', () => {
  const seed: PlatKey = {
    sigunguCd: '11680',
    bjdongCd: '10300',
    bun: '0952',
    ji: '0000',
    mountain: false,
  };

  it('시드·부속·명칭 필지를 중복 없이 모음', () => {
    const attached: PlatKey[] = [{ ...seed, bun: '0953', ji: '0000' }];
    const matched: PlatKey[] = [
      { ...seed, bun: '0953', ji: '0000' },
      { ...seed, bun: '0954', ji: '0001' },
    ];
    const plats = collectPlatKeys(seed, attached, matched);
    expect(plats).toHaveLength(3);
  });
});

describe('scaleFromSeedTitles', () => {
  it('건물명 없는 다세대 표제부에서 세대수를 읽는다', () => {
    expect(
      scaleFromSeedTitles([
        {
          useAprYear: 1987,
          dongName: null,
          buildingName: null,
          hhldCnt: 6,
          hoCnt: null,
          mainAtchGbCd: '0',
          mainAtchGbCdNm: '주건축물',
          mainPurpsCdNm: '공동주택',
          etcPurps: '다세대주택',
        },
      ]),
    ).toEqual({ householdCount: 6, buildingCount: 1 });
  });
});
