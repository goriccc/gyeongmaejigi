/**
 * 제1종 국민주택채권 매입률(‰) — 주택·소유권 이전등기 기준
 * 출처: 주택도시기금법 시행령 별표 (2022-02-17 개정) 요약
 */

/** 주택 면제 기준 시가표준액(원) */
export const HOUSING_BOND_EXEMPT_BELOW = 20_000_000;

/** 시가표준액 하한(원) 오름차순 */
export const HOUSING_BOND_PURCHASE_BRACKETS = [
  { min: 20_000_000, metro: 13, other: 13 },
  { min: 50_000_000, metro: 19, other: 14 },
  { min: 100_000_000, metro: 21, other: 16 },
  { min: 160_000_000, metro: 23, other: 18 },
  { min: 260_000_000, metro: 26, other: 21 },
  { min: 600_000_000, metro: 31, other: 26 },
] as const;

export type HousingBondRegion = 'metro' | 'other';
