import { DEFAULT_PREPAY } from '@/data/taxTable';
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
/** 중도상환수수료율 UI 기본값 (% 단위) */
export const DEFAULT_BID_PREPAY_RATE = 0.41;
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

export function resolveBidPrepayRate(saved?: number): number {
  if (saved == null) return DEFAULT_BID_PREPAY_RATE;
  return saved;
}

export type BidCalcInput = {
  /** 매도가(원) */
  sellPrice: number;
  /** 매도잔금기간(개월) */
  months: number;
  /** 대출이자율(비율, 예: 0.045) */
  loanRate: number;
  /** 중도상환수수료율(비율, 예: 0.0041) */
  prepayRate?: number;
  /** 목표 마진(비율) */
  margin: number;
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
    prepayRate = DEFAULT_PREPAY.rate,
    margin,
    conditionalExtra = 0,
    buildingVat = 0,
    entryInputs = null,
  } = input;
  const policy = resolveBidPolicy(entryInputs, entryInputs == null);
  const taxCtx = acquisitionContextFromPolicy(policy);
  const marginAmt = sellPrice * margin;
  const bidPrice = Math.max(0, sellPrice - marginAmt - conditionalExtra);
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
    prepayRate,
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
    costAmt: Math.max(0, sellPrice - marginAmt - bidPrice),
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
export type MarginTier = 'low' | 'mid' | 'high';

const TIER_LABELS: Record<MarginTier, string> = {
  low: '저마진',
  mid: '중마진',
  high: '고마진',
};

export function tierLabelText(tier: MarginTier): string {
  return TIER_LABELS[tier];
}

export function marginTier(marginPct: number): MarginTier {
  if (marginPct <= 8) return 'low';
  if (marginPct <= 12) return 'mid';
  return 'high';
}

export function marginTierClass(marginPct: number): string {
  return `margin-tier-${marginTier(marginPct)}`;
}

export function marginLabelText(marginPct: number): string {
  return tierLabelText(marginTier(marginPct));
}

/** 실투자금 대비 수익률(%) 구간 — 저마진 ~12 · 중마진 ~21 · 고마진 21 초과 */
export function yieldTier(yieldPct: number): MarginTier {
  if (yieldPct <= 12) return 'low';
  if (yieldPct <= 21) return 'mid';
  return 'high';
}

export function yieldTierClass(yieldPct: number): string {
  return `margin-tier-${yieldTier(yieldPct)}`;
}

export function yieldLabelText(yieldPct: number): string {
  return tierLabelText(yieldTier(yieldPct));
}
