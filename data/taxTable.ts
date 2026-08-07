/**
 * 최종 갱신일: 2026-08-07, 다음 갱신 예정: 매년 1월
 * 취득세 / 지방교육세 / 중개보수 요율표 — 연 1회 수동 갱신 대상
 */

/** 취득세 구간 경계 (원) */
export const ACQUISITION_TAX_BRACKETS = {
  low: 600_000_000,
  high: 900_000_000,
} as const;

/** 다주택 중과 세율 (규제지역 가정, 목업 단순화) */
export const MULTI_HOUSE_SURCHARGE_RATE = 0.08;

/** 중개보수 요율 구간 (매도가 기준) */
export const BROKER_FEE_BRACKETS = [
  { max: 900_000_000, rate: 0.004 },
  { max: 1_200_000_000, rate: 0.005 },
  { max: 1_500_000_000, rate: 0.006 },
  { max: Infinity, rate: 0.007 },
] as const;

/** 모듈 D 고정 비용 가정치 (원) */
export const FIXED_COSTS = {
  registration: 1_000_000,
  housingBond: 1_500_000,
  eviction: 2_500_000,
  misc: 600_000,
} as const;

/** 모듈 D 중도상환수수료 기본 가정 */
export const DEFAULT_PREPAY = {
  rate: 0.0041,
  periodMonths: 36,
} as const;

/** 모듈 A 부대비용 가정치 (원) */
export const ENTRY_FIXED_COST = 3_000_000;

/** 모듈 D 가정 LTV */
export const ASSUMED_LTV = 0.6;

/** 매매사업자 세후 근사 계수 */
export const AFTER_TAX_FACTOR = 0.775;
