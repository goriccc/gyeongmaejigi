/**
 * 최종 갱신일: 2026-08-07, 다음 갱신 예정: 매년 1월
 * 취득세 / 지방교육세 — 연 1회 수동 갱신 대상
 * 중개보수: data/brokerFeeRates.ts (공인중개사법 시행규칙 제20조)
 */

/** 취득세 구간 경계 (원) */
export const ACQUISITION_TAX_BRACKETS = {
  low: 600_000_000,
  high: 900_000_000,
} as const;

/** 다주택 중과 세율 (규제지역 가정, 목업 단순화) */
export const MULTI_HOUSE_SURCHARGE_RATE = 0.08;

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
