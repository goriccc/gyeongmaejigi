import type { EntryMatchInputs } from '@/types/case';
import { effectiveSellPrice } from './buildingVat';
import {
  acquisitionContextFromPolicy,
  loanPrincipalAtBid,
  resolveBidPolicy,
} from './bidPolicy';
import { calcCostItems, profitDetailedTotal } from './costItems';
import {
  calcLocalIncomeTaxOnTransferTax,
  calcNetProfitAfterBusinessTax,
  calcPreTaxProfit,
  calcTradingBusinessTransferTax,
} from './tradingTax';

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
  /** 대형 건물분 부가세(원) — 실질 매도가·상세비용에 반영 */
  buildingVat?: number;
  /** 제1장 입찰 조건 */
  entryInputs?: Partial<EntryMatchInputs> | null;
};

export type BidCalcResult = {
  bidPrice: number;
  grossProfit: number;
  transferTax: number;
  localIncomeTax: number;
  netProfit: number;
  netYield: number;
  loanPrincipal: number;
  interestCost: number;
  invested: number;
  costAmt: number;
  conditionalExtra: number;
  buildingVat: number;
  effectiveSellPrice: number;
  financeFreeDetailed: number;
  /** 세전수익용 상세비용 (건물분 부가세 이중 반영 방지) */
  profitDetailedTotal: number;
  /** 적용 LTV (0~1) */
  ltvApplied: number;
  loanBadge: string;
  loanBadgeTone: 'ok' | 'warn' | 'mid';
  /** 매도가 × 목표마진% — 역산 목표액 */
  marginTargetAmt: number;
};

/** 실투자금 = 자기자본(입찰가−대출) + 상세비용 */
export function calcInvestedCapital(
  bidPrice: number,
  loanPrincipal: number,
  profitDetailedTotal: number,
): number {
  return Math.max(0, bidPrice - loanPrincipal + profitDetailedTotal);
}

/** 실투자금 대비 세후 수익률(%) */
export function calcNetYield(netProfit: number, invested: number): number {
  return invested > 0 ? (netProfit / invested) * 100 : 0;
}

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
    buildingVat = 0,
    entryInputs = null,
  } = input;
  const policy = resolveBidPolicy(entryInputs, entryInputs == null);
  const taxCtx = acquisitionContextFromPolicy(policy);
  const costAmt = sellPrice * costRate;
  const marginAmt = sellPrice * margin;
  const bidPrice = Math.max(
    0,
    sellPrice - costAmt - marginAmt - conditionalExtra,
  );
  const loanPrincipal = loanPrincipalAtBid(bidPrice, policy);
  const interestCost = loanPrincipal * loanRate * (months / 12);
  const vatAmt = Math.max(0, buildingVat);
  const effectiveSell = effectiveSellPrice(sellPrice, vatAmt);
  const costs = calcCostItems(
    bidPrice,
    sellPrice,
    interestCost,
    loanPrincipal,
    months,
    loanRate,
    costRate,
    undefined,
    undefined,
    {},
    null,
    {},
    vatAmt,
    'standard',
    taxCtx,
  );
  const grossProfit = calcPreTaxProfit(
    effectiveSell,
    bidPrice,
    profitDetailedTotal(costs, vatAmt),
  );
  const transferTax = calcTradingBusinessTransferTax(grossProfit);
  const localIncomeTax = calcLocalIncomeTaxOnTransferTax(transferTax);
  const netProfit = calcNetProfitAfterBusinessTax(grossProfit, transferTax);
  const profitDetailed = profitDetailedTotal(costs, vatAmt);
  const invested = calcInvestedCapital(bidPrice, loanPrincipal, profitDetailed);
  const netYield = calcNetYield(netProfit, invested);
  const prepayFee = costs.items.find((i) => i.key === 'prepay')?.amount ?? 0;

  return {
    bidPrice,
    grossProfit,
    transferTax,
    localIncomeTax,
    netProfit,
    netYield,
    loanPrincipal,
    interestCost,
    invested,
    costAmt,
    conditionalExtra,
    buildingVat: vatAmt,
    effectiveSellPrice: effectiveSell,
    financeFreeDetailed: profitDetailed - interestCost - prepayFee,
    profitDetailedTotal: profitDetailed,
    ltvApplied: policy.ltvRate,
    loanBadge: policy.loanBadge,
    loanBadgeTone: policy.loanBadgeTone,
    marginTargetAmt: marginAmt,
  };
}

/**
 * 목표 마진 슬라이더 라벨 텍스트.
 * @param marginPct - 마진 % (3~20)
 */
export function marginLabelText(marginPct: number): string {
  if (marginPct <= 5) return '저마진';
  if (marginPct <= 10) return '중마진';
  return '고마진';
}
