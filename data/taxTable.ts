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
  /** 말소비 — 필수 고정 */
  cancellation: 100_000,
} as const;

/** 기타비용(교통·청소 등) 조건부 기본값 — 30만원 */
export const DEFAULT_MISC_OTHER_MAN = 30;
export const DEFAULT_MISC_OTHER_WON = DEFAULT_MISC_OTHER_MAN * 10_000;

/** 모듈 D 중도상환수수료 기본 가정 */
export const DEFAULT_PREPAY = {
  rate: 0.0041,
  periodMonths: 36,
} as const;

/** 모듈 A 부대비용 가정치 (원) */
export const ENTRY_FIXED_COST = 3_000_000;

/** 모듈 D 가정 LTV */
export const ASSUMED_LTV = 0.7;

/** V11 엑셀 D30 — 개략(5%)과 상세(E29) 차액의 50%를 2차 입찰가에 가산 */
export const APPROX_DETAIL_BLEND = 0.5;

/** 매매사업자 양도소득 과세표준 구간 (종합소득세 누진세율) */
export type TradingBusinessIncomeTaxBracket = {
  /** 구간 상한(원). 마지막 구간은 Infinity */
  maxBase: number;
  rate: number;
  /** 누진공제(원) */
  deduction: number;
};

export const TRADING_BUSINESS_INCOME_TAX_BRACKETS: TradingBusinessIncomeTaxBracket[] =
  [
    { maxBase: 14_000_000, rate: 0.06, deduction: 0 },
    { maxBase: 50_000_000, rate: 0.15, deduction: 1_260_000 },
    { maxBase: 88_000_000, rate: 0.24, deduction: 5_760_000 },
    { maxBase: 150_000_000, rate: 0.35, deduction: 15_440_000 },
    { maxBase: 300_000_000, rate: 0.38, deduction: 19_940_000 },
    { maxBase: 500_000_000, rate: 0.4, deduction: 25_940_000 },
    { maxBase: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
    { maxBase: Infinity, rate: 0.45, deduction: 65_940_000 },
  ];

/** 양도소득세(국세)에 부과되는 지방소득세 — 국세의 10% (엑셀 E36×10%) */
export const LOCAL_INCOME_TAX_ON_NATIONAL_RATE = 0.1;

/** @deprecated 누진세율 도입 전 근사치 — calcTradingBusinessTransferTax 사용 */
export const AFTER_TAX_FACTOR = 0.775;
