/**
 * 규제지역·권역 데이터
 * 최종 갱신일: 2026-08-08
 * 출처: 국토교통부 고시 (2026.7.1 화성시 동탄구·용인시 기흥구·구리시 추가 지정 반영)
 *
 * LTV(대출가능여부)는 2025.6.27 부동산대책 기준: 수도권(서울·경기·인천) 전역.
 * 취득세 중과(8%/12%)는 이와 별개로 규제구분(규제지역) 매트릭스 적용.
 */

export const REGULATED_AS_OF = '2026-08-08';

/**
 * 저가주택 특례 공시가격 기준(수도권 1억 / 지방 2억) — 취득세 계산·지도 표시용
 */
export const SUDOGWON = ['서울', '경기', '인천'];

/**
 * 취득세 규제구분 안내용 (지도 LTV 판정에는 사용하지 않음).
 * 모듈 A "물건 소재지 규제구분" select 참고용.
 */
export const PARTIAL_REGIONS: Record<string, string[]> = {
  경기: [
    '과천시',
    '광명시',
    '성남시 분당·수정·중원구',
    '수원시 영통·장안·팔달구',
    '안양시 동안구',
    '용인시 수지구',
    '용인시 기흥구',
    '의왕시',
    '하남시',
    '화성시 동탄구',
    '구리시',
  ],
};

/** @deprecated 지도 LTV는 SUDOGWON membership으로 판정. 서울 전역 표시용으로만 유지 */
export const REGULATED_REGIONS: Record<string, 'full'> = {
  서울: 'full',
};

export type RegionStatus = 'ok' | 'warn' | 'blocked';

export function lowPriceThreshold(region: string): '1억' | '2억' {
  return SUDOGWON.includes(region) ? '1억' : '2억';
}

/**
 * 매수 후 주택수 기준 상태 판정 (2025.6.27 대책 + 취득세 중과)
 * - houseCount=0: 항상 ok
 * - dispositionPlanned: 무주택자와 동일 → ok
 * - houseCount=1: 지방 ok / 수도권 blocked
 * - houseCount>=2: 수도권 blocked / 지방 warn(저가특례 시 ok — 취득세 중과 해소)
 */
export function regionStatus(
  isSudogwon: boolean,
  houseCount: 0 | 1 | 2 | 3,
  lowPriceException = false,
  dispositionPlanned = false,
): RegionStatus {
  if (houseCount === 0) return 'ok';
  if (dispositionPlanned) return 'ok';
  if (houseCount === 1) {
    if (!isSudogwon) return 'ok';
    return 'blocked';
  }
  // houseCount 2·3
  if (isSudogwon) return 'blocked';
  return lowPriceException ? 'ok' : 'warn';
}

/** 설정 기준 권역별 투자(대출) 가능 여부 — 2025.6.27 대책 표 */
export function regionInvestPossible(
  isSudogwon: boolean,
  houseCount: 0 | 1 | 2 | 3,
  dispositionPlanned = false,
): boolean {
  if (houseCount === 0) return true;
  if (houseCount === 1 && dispositionPlanned) return true;
  if (!isSudogwon) return true;
  return false;
}

export function regionInvestTitleLabels(
  houseCount: 0 | 1 | 2 | 3,
  dispositionPlanned = false,
  lowPriceException = false,
): { sudogwon: string; regional: string } {
  const sudogwon = regionInvestPossible(true, houseCount, dispositionPlanned)
    ? '가능'
    : '불가';

  if (!regionInvestPossible(false, houseCount, dispositionPlanned)) {
    return { sudogwon, regional: '불가' };
  }
  if (houseCount === 2 && !lowPriceException) {
    return { sudogwon, regional: '가능 (취득세 8%)' };
  }
  if (houseCount >= 3 && !lowPriceException) {
    return { sudogwon, regional: '가능 (취득세 12%)' };
  }
  return { sudogwon, regional: '가능' };
}

/** 스키매틱 타일 배치 (실제 지리 좌표 아님) */
export const REGION_TILES: Array<{
  name: string;
  column: number;
  row: number;
}> = [
  { name: '서울', column: 2, row: 1 },
  { name: '강원', column: 3, row: 1 },
  { name: '인천', column: 1, row: 2 },
  { name: '경기', column: 2, row: 2 },
  { name: '충북', column: 3, row: 3 },
  { name: '세종', column: 2, row: 3 },
  { name: '경북', column: 4, row: 3 },
  { name: '대전', column: 2, row: 4 },
  { name: '충남', column: 1, row: 4 },
  { name: '대구', column: 4, row: 4 },
  { name: '전북', column: 1, row: 5 },
  { name: '울산', column: 5, row: 5 },
  { name: '전남', column: 1, row: 6 },
  { name: '광주', column: 2, row: 6 },
  { name: '경남', column: 4, row: 6 },
  { name: '부산', column: 5, row: 6 },
  { name: '제주', column: 2, row: 8 },
];
