/**
 * 주택수별 기준 LTV를 반환합니다.
 * @param houseCount - 0: 무주택, 1: 1주택, 2+: 2주택 이상
 * @returns LTV 비율 (0~1)
 */
export function baseLTV(houseCount: number): number {
  if (houseCount === 0) return 0.7;
  if (houseCount === 1) return 0.6;
  return 0.4;
}

/**
 * 신용 보정(+/-)을 적용하고 0.2~0.8로 클램프합니다.
 * @param houseCount - 현재 주택수
 * @param creditAdj - LTV 보정치 (우수 +0.05, 보통 0, 주의 -0.05)
 * @returns 적용 LTV
 */
export function applyLtvWithCredit(
  houseCount: number,
  creditAdj: number,
): number {
  return Math.min(0.8, Math.max(0.2, baseLTV(houseCount) + creditAdj));
}

/** 신용 상태 → LTV 보정·가정금리 매핑 */
export const CREDIT_MAP = {
  우수: { adj: 0.05, rate: 0.04, label: '우수' },
  보통: { adj: 0, rate: 0.045, label: '보통' },
  주의: { adj: -0.05, rate: 0.052, label: '주의' },
} as const;

export type CreditState = keyof typeof CREDIT_MAP;
