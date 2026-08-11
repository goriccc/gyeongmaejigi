import { AFTER_TAX_FACTOR, ASSUMED_LTV } from '@/data/taxTable';

/** 입찰가 계산 UI 기본값 (% 단위) */
export const DEFAULT_BID_LOAN_RATE = 5;
export const DEFAULT_BID_MARGIN = 10;
/** 이전 UI 기본값 — 저장값 마이그레이션용 */
const LEGACY_BID_LOAN_RATE = 4.5;
const LEGACY_BID_MARGIN = 5.5;

export function resolveBidLoanRate(saved?: number): number {
  if (saved == null) return DEFAULT_BID_LOAN_RATE;
  if (saved === LEGACY_BID_LOAN_RATE) return DEFAULT_BID_LOAN_RATE;
  return saved;
}

export function resolveBidMargin(saved?: number): number {
  if (saved == null) return DEFAULT_BID_MARGIN;
  if (saved === LEGACY_BID_MARGIN) return DEFAULT_BID_MARGIN;
  return saved;
}

export type BidCalcInput = {
  /** 매도가(원) */
  sellPrice: number;
  /** 매도잔금기간(개월) */
  months: number;
  /** 대출이자율(비율, 예: 0.045) */
  loanRate: number;
  /** 목표 마진(비율) */
  margin: number;
  /** 취득 비용률(비율) */
  costRate: number;
  /** 조건부 추가비용 합계(원) — 입찰가에서 선차감 */
  conditionalExtra?: number;
};

export type BidCalcResult = {
  bidPrice: number;
  grossProfit: number;
  netProfit: number;
  netYield: number;
  loanPrincipal: number;
  interestCost: number;
  invested: number;
  costAmt: number;
  conditionalExtra: number;
};

/**
 * 목표마진 기반 입찰가를 역산합니다.
 * @param input - 입찰가 계산 입력
 * @returns 역산 결과
 */
export function calcBid(input: BidCalcInput): BidCalcResult {
  const {
    sellPrice,
    months,
    loanRate,
    margin,
    costRate,
    conditionalExtra = 0,
  } = input;
  const costAmt = sellPrice * costRate;
  const marginAmt = sellPrice * margin;
  const bidPrice = Math.max(
    0,
    sellPrice - costAmt - marginAmt - conditionalExtra,
  );
  const grossProfit = marginAmt;
  const loanPrincipal = bidPrice * ASSUMED_LTV;
  const interestCost = loanPrincipal * loanRate * (months / 12);
  const netProfit = grossProfit * AFTER_TAX_FACTOR - interestCost;
  const invested = bidPrice - loanPrincipal;
  const netYield = invested > 0 ? (netProfit / invested) * 100 : 0;

  return {
    bidPrice,
    grossProfit,
    netProfit,
    netYield,
    loanPrincipal,
    interestCost,
    invested,
    costAmt,
    conditionalExtra,
  };
}

/**
 * 목표 마진 슬라이더 라벨 텍스트.
 * @param marginPct - 마진 % (3~15)
 */
export function marginLabelText(marginPct: number): string {
  if (marginPct <= 4) return '저마진';
  if (marginPct <= 6.5) return '중마진';
  return '고마진';
}
