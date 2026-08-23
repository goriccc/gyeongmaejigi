import { ENTRY_FIXED_COST } from '@/data/taxTable';
import {
  acquisitionTaxRate,
  firstTimeTaxDeduction,
  type HouseCount,
  type RegZone,
} from './acquisitionTax';
import {
  dsrAnnualRepayCapacity,
  dsrAssessmentRate,
  dsrLoanCapacityEqualPayment,
  dsrLoanCapacityEqualPrincipal,
  stressDsrBreakdown,
  type MortgageRateType,
  type StressDsrMode,
} from './dsr';
import {
  applyLtvWithPolicy,
  CREDIT_MAP,
  loanAmountCap,
  ltvCap,
  type CreditState,
} from './ltv';

export type BindingConstraint = 'LTV' | 'DSR' | 'CAP';

/** DSR 한도 산출 상환방식 */
export type DsrRepaymentMethod = 'equalPrincipal' | 'equalPayment';

export type EntryMatchInput = {
  /** 시드머니(원) */
  seedMoney: number;
  houseCount: HouseCount;
  creditState: CreditState;
  /** 연소득(원) */
  annualIncome: number;
  /** DSR 한도 비율 (1금융 0.4 / 2금융 0.5) */
  dsrRate: number;
  regZone?: RegZone;
  sudogwon?: boolean;
  lowPriceException?: boolean;
  dispositionPlanned?: boolean;
  /** 생애최초 주택구입자 (무주택일 때만 의미) */
  firstTimeBuyer?: boolean;
  /** 서민·실수요자 (무주택일 때만 의미) */
  realDemand?: boolean;
  /** 기존 대출 연간 원리금(원) — DSR 잔여 여력 */
  existingAnnualDebt?: number;
  /** 스트레스 반영 모드 */
  stressMode?: StressDsrMode;
  /** 금리유형 — 1차 기본 변동형 */
  rateType?: MortgageRateType;
  /** 실제 대출금리(연 비율). 미입력 시 신용 상태 추정값 */
  contractRate?: number;
  /** 입찰 상한에 쓸 DSR 상환방식 */
  dsrRepaymentMethod?: DsrRepaymentMethod;
};

export type EntryMatchResult = {
  bidCapacity: number;
  ltvApplied: number;
  /** 입찰 상한에 쓰는 DSR 한도 (원금균등·정책기본) */
  dsrCapacity: number;
  /** 원리금균등·동일 산정금리 (서브 참고) */
  dsrCapacityEqualPayment: number;
  /** 원금균등 한도 */
  dsrCapacityEqualPrincipal: number;
  loanCapacity: number;
  binding: BindingConstraint;
  loanBadge: string;
  loanBadgeTone: 'ok' | 'warn' | 'mid';
  ltvUnverified: boolean;
  taxRate: number;
  taxAmount: number;
  taxDeduction: number;
  sizeGuide: string;
  /** 약정(가정)금리 */
  contractRate: number;
  /** 심사가산(%p → 비율) */
  stressPremium: number;
  /** DSR 산정금리 = 약정 + 가산 (또는 커스텀) */
  assessmentRate: number;
  stressLabel: string;
  stressNotice: string;
  annualRepayCapacity: number;
  dsrRepaymentMethod: DsrRepaymentMethod;
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
}): { loanBadge: string; loanBadgeTone: 'ok' | 'warn' | 'mid' } {
  const {
    binding,
    firstTimeBuyer,
    realDemand,
    dispositionPlanned,
    houseCount,
    sudogwon,
    zoneCap,
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
 * LTV → DSR(원금균등) → 절대금액 캡 순으로 실투자 가능 낙찰가를 역산합니다.
 * 원리금균등 한도는 참고값으로만 함께 산출합니다.
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
    existingAnnualDebt = 0,
    stressMode = 'policy',
    rateType = 'floating',
    dsrRepaymentMethod = 'equalPrincipal',
  } = input;

  const firstTimeBuyer = houseCount === 0 && Boolean(input.firstTimeBuyer);
  const realDemand = houseCount === 0 && Boolean(input.realDemand);
  const dispositionPlanned =
    Boolean(dispositionPlannedRaw) && houseCount === 1;

  const credit = CREDIT_MAP[creditState];
  const contractRate = input.contractRate ?? credit.rate;
  const breakdown = stressDsrBreakdown({ sudogwon, regZone, rateType });

  let stressPremium = 0;
  let assessmentRate = contractRate;
  let stressLabel = breakdown.label;
  let stressNotice = breakdown.notice;

  if (stressMode === 'none') {
    stressPremium = 0;
    assessmentRate = contractRate;
    stressLabel = '스트레스 제외 · 실제 대출금리만';
    stressNotice =
      '한도 비교용입니다. 실제 심사는 스트레스금리를 가산합니다.';
  } else {
    stressPremium = breakdown.premium;
    assessmentRate = dsrAssessmentRate(contractRate, stressPremium);
  }

  const annualRepayCapacity = dsrAnnualRepayCapacity(
    annualIncome,
    dsrRate,
    existingAnnualDebt,
  );
  const dsrCapacityEqualPrincipal = dsrLoanCapacityEqualPrincipal(
    annualRepayCapacity,
    assessmentRate,
    30,
  );
  const dsrCapacityEqualPayment = dsrLoanCapacityEqualPayment(
    annualRepayCapacity,
    assessmentRate,
    30,
  );
  const dsrCapacity =
    dsrRepaymentMethod === 'equalPayment'
      ? dsrCapacityEqualPayment
      : dsrCapacityEqualPrincipal;

  const lenderLtv = dsrRate;
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
    !dispositionPlanned;

  const { loanBadge, loanBadgeTone } = loanBadgeFor({
    binding,
    firstTimeBuyer,
    realDemand,
    dispositionPlanned,
    houseCount,
    sudogwon,
    zoneCap,
  });

  return {
    bidCapacity: price,
    ltvApplied: ltv,
    dsrCapacity,
    dsrCapacityEqualPayment,
    dsrCapacityEqualPrincipal,
    loanCapacity: loanAmt,
    binding,
    loanBadge,
    loanBadgeTone,
    ltvUnverified,
    taxRate,
    taxAmount,
    taxDeduction,
    sizeGuide: sizeGuideText(price),
    contractRate,
    stressPremium,
    assessmentRate,
    stressLabel,
    stressNotice,
    annualRepayCapacity,
    dsrRepaymentMethod,
  };
}
