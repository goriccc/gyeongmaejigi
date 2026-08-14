import type { EntryMatchInputs } from '@/types/case';
import {
  acquisitionTaxRate,
  firstTimeTaxDeduction,
  normalizeRegZone,
  type HouseCount,
  type RegZone,
} from './acquisitionTax';
import {
  applyLtvWithPolicy,
  CREDIT_MAP,
  loanAmountCap,
  ltvCap,
  type CreditState,
} from './ltv';

/** 제4장 기본 가정 — 제1장 미설정 시 (무주택·수도권·LTV 70%) */
export const DEFAULT_BID_POLICY_INPUTS: EntryMatchInputs = {
  seedMoney: 0,
  houseCount: 0,
  creditState: '보통',
  propType: '아파트',
  lenderType: '1금융권',
  regZone: 'none',
  sudogwon: true,
  lowPriceException: false,
  dispositionPlanned: false,
  firstTimeBuyer: false,
  realDemand: false,
};

export type ResolvedBidPolicy = {
  houseCount: HouseCount;
  regZone: RegZone;
  sudogwon: boolean;
  lowPriceException: boolean;
  dispositionPlanned: boolean;
  firstTimeBuyer: boolean;
  realDemand: boolean;
  creditState: CreditState;
  ltvRate: number;
  loanBadge: string;
  loanBadgeTone: 'ok' | 'warn' | 'mid';
  usesDefaultPolicy: boolean;
};

export type AcquisitionTaxContext = {
  houseCount: HouseCount;
  regZone: RegZone;
  lowPriceException: boolean;
  dispositionPlanned: boolean;
  firstTimeBuyer: boolean;
};

function normalizeHouseCount(n: number): HouseCount {
  if (n >= 3) return 3;
  if (n === 2) return 2;
  if (n === 1) return 1;
  return 0;
}

function bidLoanBadge(params: {
  firstTimeBuyer: boolean;
  realDemand: boolean;
  dispositionPlanned: boolean;
  houseCount: HouseCount;
  sudogwon: boolean;
  zoneCap: number;
  ltvRate: number;
}): { loanBadge: string; loanBadgeTone: 'ok' | 'warn' | 'mid' } {
  const {
    firstTimeBuyer,
    realDemand,
    dispositionPlanned,
    houseCount,
    sudogwon,
    zoneCap,
    ltvRate,
  } = params;

  if (firstTimeBuyer) {
    return { loanBadge: '생애최초 우대 LTV 적용', loanBadgeTone: 'ok' };
  }
  if (realDemand) {
    return { loanBadge: '서민·실수요자 우대 LTV 적용', loanBadgeTone: 'ok' };
  }
  if (dispositionPlanned && houseCount === 1) {
    return {
      loanBadge: '처분조건부 · 무주택자 기준 적용',
      loanBadgeTone: 'mid',
    };
  }
  if (sudogwon && houseCount >= 1 && zoneCap === 0) {
    return { loanBadge: '수도권 다주택 대출금지', loanBadgeTone: 'warn' };
  }
  if (ltvRate <= 0) {
    return { loanBadge: '대출 없음 (LTV 0%)', loanBadgeTone: 'warn' };
  }
  return {
    loanBadge: `LTV ${(ltvRate * 100).toFixed(0)}% 적용`,
    loanBadgeTone: 'mid',
  };
}

/** 제1장 입찰 조건 → 제4장 LTV·취득세 컨텍스트 */
export function resolveBidPolicy(
  raw?: Partial<EntryMatchInputs> | null,
  usesDefaultPolicy = false,
): ResolvedBidPolicy {
  const input = { ...DEFAULT_BID_POLICY_INPUTS, ...raw };
  const houseCount = normalizeHouseCount(input.houseCount);
  const sudogwon = input.sudogwon ?? true;
  const regZone = sudogwon
    ? normalizeRegZone(input.regZone)
    : ('none' as RegZone);
  const lowPriceException = Boolean(input.lowPriceException);
  const dispositionPlanned =
    Boolean(input.dispositionPlanned) && houseCount === 1;
  const firstTimeBuyer = houseCount === 0 && Boolean(input.firstTimeBuyer);
  const realDemand = houseCount === 0 && Boolean(input.realDemand);
  const creditState = (input.creditState ?? '보통') as CreditState;
  const credit = CREDIT_MAP[creditState] ?? CREDIT_MAP.보통;

  const zoneCap = ltvCap(
    sudogwon,
    regZone,
    houseCount,
    lowPriceException,
    dispositionPlanned,
    0.4,
    firstTimeBuyer,
    realDemand,
  );
  const ltvRate = applyLtvWithPolicy(
    houseCount,
    credit.adj,
    sudogwon,
    regZone,
    lowPriceException,
    dispositionPlanned,
    0.4,
    firstTimeBuyer,
    realDemand,
  );

  const { loanBadge, loanBadgeTone } = bidLoanBadge({
    firstTimeBuyer,
    realDemand,
    dispositionPlanned,
    houseCount,
    sudogwon,
    zoneCap,
    ltvRate,
  });

  return {
    houseCount,
    regZone,
    sudogwon,
    lowPriceException,
    dispositionPlanned,
    firstTimeBuyer,
    realDemand,
    creditState,
    ltvRate,
    loanBadge,
    loanBadgeTone,
    usesDefaultPolicy,
  };
}

export function acquisitionContextFromPolicy(
  policy: ResolvedBidPolicy,
): AcquisitionTaxContext {
  return {
    houseCount: policy.houseCount,
    regZone: policy.regZone,
    lowPriceException: policy.lowPriceException,
    dispositionPlanned: policy.dispositionPlanned,
    firstTimeBuyer: policy.firstTimeBuyer,
  };
}

/** 낙찰가 기준 대출원금 — LTV·수도권 절대금액 캡 반영 */
export function loanPrincipalAtBid(
  bidPrice: number,
  policy: ResolvedBidPolicy,
): number {
  if (bidPrice <= 0 || policy.ltvRate <= 0) return 0;
  const byLtv = bidPrice * policy.ltvRate;
  const cap = loanAmountCap(policy.sudogwon, bidPrice);
  return Math.min(byLtv, cap);
}

export function calcAcquisitionTaxAmount(
  bidPrice: number,
  ctx: AcquisitionTaxContext,
): { rate: number; amount: number; deduction: number } {
  const rate = acquisitionTaxRate(
    bidPrice,
    ctx.houseCount,
    ctx.regZone,
    ctx.lowPriceException,
    ctx.dispositionPlanned,
  );
  const raw = bidPrice * rate;
  const deduction = firstTimeTaxDeduction(
    ctx.firstTimeBuyer,
    bidPrice,
    raw,
  );
  return { rate, amount: raw - deduction, deduction };
}
