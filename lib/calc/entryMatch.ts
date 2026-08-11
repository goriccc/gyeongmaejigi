import { ENTRY_FIXED_COST } from '@/data/taxTable';
import {
  acquisitionTaxRate,
  firstTimeTaxDeduction,
  type HouseCount,
  type RegZone,
} from './acquisitionTax';
import { dsrLoanCapacity, stressDsrPremium } from './dsr';
import {
  applyLtvWithPolicy,
  CREDIT_MAP,
  loanAmountCap,
  ltvCap,
  type CreditState,
} from './ltv';

export type BindingConstraint = 'LTV' | 'DSR' | 'CAP';

export type EntryMatchInput = {
  /** 시드머니(원) */
  seedMoney: number;
  houseCount: HouseCount;
  creditState: CreditState;
  /** 연소득(원) — 세션 전용, 저장하지 않음 */
  annualIncome: number;
  /** DSR 한도 비율 (1금융 0.4 / 2금융 0.5). 저가특례 lenderLtv로도 사용 */
  dsrRate: number;
  regZone?: RegZone;
  sudogwon?: boolean;
  lowPriceException?: boolean;
  dispositionPlanned?: boolean;
  /** 생애최초 주택구입자 (무주택일 때만 의미) */
  firstTimeBuyer?: boolean;
  /** 서민·실수요자 (무주택일 때만 의미) */
  realDemand?: boolean;
};

export type EntryMatchResult = {
  bidCapacity: number;
  ltvApplied: number;
  dsrCapacity: number;
  loanCapacity: number;
  binding: BindingConstraint;
  loanBadge: string;
  loanBadgeTone: 'ok' | 'warn' | 'mid';
  ltvUnverified: boolean;
  taxRate: number;
  taxAmount: number;
  taxDeduction: number;
  sizeGuide: string;
  stressPremium: number;
};

/**
 * 낙찰가 규모 가이드 텍스트를 반환합니다.
 */
export function sizeGuideText(price: number): string {
  if (price < 300_000_000) return '소형 (3억원 미만)';
  if (price < 600_000_000) return '중형 (3~6억원대)';
  if (price < 900_000_000) return '중대형 (6~9억원대)';
  return '대형 (9억원 이상)';
}

function loanBadgeFor(params: {
  binding: BindingConstraint;
  firstTimeBuyer: boolean;
  realDemand: boolean;
  dispositionPlanned: boolean;
  houseCount: HouseCount;
  sudogwon: boolean;
  zoneCap: number;
  lowPriceException: boolean;
}): { loanBadge: string; loanBadgeTone: 'ok' | 'warn' | 'mid' } {
  const {
    binding,
    firstTimeBuyer,
    realDemand,
    dispositionPlanned,
    houseCount,
    sudogwon,
    zoneCap,
    lowPriceException,
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
  if (sudogwon && houseCount >= 1 && lowPriceException) {
    return { loanBadge: '저가주택 특례 LTV 적용', loanBadgeTone: 'mid' };
  }
  if (binding === 'CAP') {
    return {
      loanBadge: '대출한도 절대금액 상한(수도권)',
      loanBadgeTone: 'warn',
    };
  }
  return {
    loanBadge: `${binding} 제약`,
    loanBadgeTone: binding === 'LTV' ? 'mid' : 'warn',
  };
}

/**
 * LTV → DSR → 절대금액 캡 순으로 실투자 가능 낙찰가를 역산합니다.
 */
export function calcEntryMatch(input: EntryMatchInput): EntryMatchResult {
  const {
    seedMoney,
    houseCount,
    creditState,
    annualIncome,
    dsrRate,
    regZone = 'none',
    sudogwon = true,
    lowPriceException = false,
    dispositionPlanned: dispositionPlannedRaw = false,
  } = input;

  const firstTimeBuyer = houseCount === 0 && Boolean(input.firstTimeBuyer);
  const realDemand = houseCount === 0 && Boolean(input.realDemand);
  // 처분조건부(일시적 2주택)는 현재 1주택일 때만 유효
  const dispositionPlanned =
    Boolean(dispositionPlannedRaw) && houseCount === 1;

  const credit = CREDIT_MAP[creditState];
  const stressPremium = stressDsrPremium(sudogwon);
  const dsrCapacity = dsrLoanCapacity(
    annualIncome,
    dsrRate,
    credit.rate + stressPremium,
    30,
  );

  const lenderLtv = dsrRate; // 1금융 40% / 2금융 50% (저가특례)
  const zoneCap = ltvCap(
    sudogwon,
    regZone,
    houseCount,
    lowPriceException,
    dispositionPlanned,
    lenderLtv,
    firstTimeBuyer,
    realDemand,
  );
  const ltv = applyLtvWithPolicy(
    houseCount,
    credit.adj,
    sudogwon,
    regZone,
    lowPriceException,
    dispositionPlanned,
    lenderLtv,
    firstTimeBuyer,
    realDemand,
  );

  const fixedCost = ENTRY_FIXED_COST;
  const taxOpts = [
    houseCount,
    regZone,
    lowPriceException,
    dispositionPlanned,
  ] as const;

  // 1) LTV 역산
  let priceByLTV =
    ltv <= 0
      ? Math.max(0, (seedMoney - fixedCost) / (1 + 0.01))
      : (seedMoney - fixedCost) / (1 - ltv + 0.01);
  for (let i = 0; i < 8; i++) {
    const rate = acquisitionTaxRate(priceByLTV, ...taxOpts);
    priceByLTV =
      ltv <= 0
        ? (seedMoney - fixedCost) / (1 + rate)
        : (seedMoney - fixedCost) / (1 - ltv + rate);
  }
  priceByLTV = Math.max(0, priceByLTV);

  let price: number;
  let loanAmt: number;
  let binding: BindingConstraint;

  if (priceByLTV * ltv <= dsrCapacity) {
    price = priceByLTV;
    loanAmt = price * ltv;
    binding = 'LTV';
  } else {
    let priceByDSR = seedMoney + dsrCapacity - fixedCost;
    for (let i = 0; i < 8; i++) {
      const rate = acquisitionTaxRate(priceByDSR, ...taxOpts);
      priceByDSR = (seedMoney + dsrCapacity - fixedCost) / (1 + rate);
    }
    price = Math.max(0, priceByDSR);
    loanAmt = dsrCapacity;
    binding = 'DSR';
  }

  // 3) 절대금액 캡
  const cap = loanAmountCap(sudogwon, price);
  if (loanAmt > cap) {
    let priceByCap = seedMoney + cap - fixedCost;
    for (let i = 0; i < 8; i++) {
      const rate = acquisitionTaxRate(priceByCap, ...taxOpts);
      const capNow = loanAmountCap(sudogwon, priceByCap);
      priceByCap = (seedMoney + capNow - fixedCost) / (1 + rate);
    }
    price = Math.max(0, priceByCap);
    loanAmt = loanAmountCap(sudogwon, price);
    binding = 'CAP';
  }

  const taxRate = acquisitionTaxRate(price, ...taxOpts);
  const taxRaw = price * taxRate;
  const taxDeduction = firstTimeTaxDeduction(firstTimeBuyer, price, taxRaw);
  const taxAmount = taxRaw - taxDeduction;

  const ltvUnverified =
    !sudogwon &&
    houseCount >= 1 &&
    !firstTimeBuyer &&
    !realDemand &&
    !lowPriceException &&
    !dispositionPlanned;

  const { loanBadge, loanBadgeTone } = loanBadgeFor({
    binding,
    firstTimeBuyer,
    realDemand,
    dispositionPlanned,
    houseCount,
    sudogwon,
    zoneCap,
    lowPriceException,
  });

  return {
    bidCapacity: price,
    ltvApplied: ltv,
    dsrCapacity,
    loanCapacity: loanAmt,
    binding,
    loanBadge,
    loanBadgeTone,
    ltvUnverified,
    taxRate,
    taxAmount,
    taxDeduction,
    sizeGuide: sizeGuideText(price),
    stressPremium,
  };
}
