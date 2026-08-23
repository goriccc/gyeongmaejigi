import type { RegZone } from './acquisitionTax';

/** 스트레스 DSR 모드 — 한도 산정용 */
export type StressDsrMode = 'policy' | 'none';

/**
 * 금리유형. 1차는 변동형 기본.
 * 혼합·주기는 고정기간 비중에 따라 가산이 완화된다.
 */
export type MortgageRateType = 'floating' | 'hybrid' | 'periodic';

export type HybridFixedShare = 'low' | 'mid' | 'high';

/**
 * 2026.7.1~12.31 은행연합회·금융위 행정지도 기준.
 * 수도권·규제지역 주담대: 스트레스금리 3.0% × 3단계 100%
 * 지방·비규제 주담대: 스트레스금리 1.5% × 2단계 유예 50% → 0.75%p
 */
export const STRESS_DSR_NOTICE =
  '2026.7~12 · 지방 비규제 주담대는 2단계 유예(0.75%p) · 수도권·규제는 3.0%p';

export type StressDsrBreakdown = {
  /** 고시 스트레스금리 (연, 비율) */
  stressRate: number;
  /** 단계별 기본적용비율 0~1 */
  stageRatio: number;
  /** 대출유형별 적용비율 0~1 */
  productRatio: number;
  /** 최종 심사가산(%p → 비율) = stressRate × stageRatio × productRatio */
  premium: number;
  /** 수도권 또는 규제지역 주담대 테이블 사용 여부 */
  usesCapitalTable: boolean;
  label: string;
  notice: string;
};

function productRatioFor(
  rateType: MortgageRateType,
  hybridFixedShare: HybridFixedShare = 'mid',
): number {
  if (rateType === 'floating') return 1;
  if (rateType === 'periodic') {
    // 주기형: 변동주기 비중이 클수록 높음 — 1차 단순화
    if (hybridFixedShare === 'high') return 0;
    if (hybridFixedShare === 'mid') return 0.6;
    return 1;
  }
  // 혼합형: 고정기간 비중
  if (hybridFixedShare === 'high') return 0; // 만기 70%+ 고정 ≈ 미적용
  if (hybridFixedShare === 'mid') return 0.6;
  return 1;
}

/**
 * 지역·규제·금리유형에 따른 스트레스 DSR 가산 분해.
 * 경락대출은 담보대출이므로 신용대출 1억 예외와 무관하게 적용한다.
 */
export function stressDsrBreakdown(input: {
  sudogwon: boolean;
  regZone?: RegZone;
  rateType?: MortgageRateType;
  hybridFixedShare?: HybridFixedShare;
}): StressDsrBreakdown {
  const rateType = input.rateType ?? 'floating';
  const usesCapitalTable =
    Boolean(input.sudogwon) || input.regZone === 'adjusted';

  const stressRate = usesCapitalTable ? 0.03 : 0.015;
  const stageRatio = usesCapitalTable ? 1 : 0.5;
  const productRatio = productRatioFor(
    rateType,
    input.hybridFixedShare ?? 'mid',
  );
  const premium = stressRate * stageRatio * productRatio;

  const regionLabel = usesCapitalTable
    ? input.sudogwon
      ? '수도권'
      : '규제지역'
    : '지방·비규제';
  const typeLabel =
    rateType === 'floating'
      ? '변동형'
      : rateType === 'hybrid'
        ? '혼합형'
        : '주기형';
  const pct = (premium * 100).toFixed(premium % 0.01 === 0 ? 1 : 2);

  return {
    stressRate,
    stageRatio,
    productRatio,
    premium,
    usesCapitalTable,
    label: `${regionLabel}·${typeLabel} · +${pct}%p`,
    notice: usesCapitalTable
      ? '수도권·규제지역 주담대: 스트레스 3.0% × 3단계 100%'
      : '지방 비규제 주담대: 스트레스 1.5% × 2단계 50%(유예) = 0.75%p',
  };
}

/**
 * @deprecated stressDsrBreakdown 사용. 하위호환용.
 * 수도권·규제 3.0%p / 지방·비규제 0.75%p (변동형 기준).
 */
export function stressDsrPremium(
  isSudogwon: boolean,
  regZone: RegZone = 'none',
): number {
  return stressDsrBreakdown({ sudogwon: isSudogwon, regZone }).premium;
}

/** DSR 산정금리 = 약정(가정)금리 + 심사가산 */
export function dsrAssessmentRate(
  contractRate: number,
  premium: number,
): number {
  return Math.max(0, contractRate + premium);
}

/**
 * 원리금균등상환 — 월복리 연금현재가치 (은행·엑셀 산식과 동일).
 * @param assessmentRate - DSR 산정금리(스트레스 포함, 연 비율)
 */
export function dsrLoanCapacityEqualPayment(
  annualRepayCapacity: number,
  assessmentRate: number,
  years = 30,
): number {
  if (annualRepayCapacity <= 0) return 0;
  const months = years * 12;
  const monthlyPay = annualRepayCapacity / 12;
  const rMonth = assessmentRate / 12;
  if (rMonth <= 0) return monthlyPay * months;
  return (monthlyPay * (1 - Math.pow(1 + rMonth, -months))) / rMonth;
}

/**
 * 원금균등상환 — 1회차(최대 월상환) 기준 역산.
 * 월상환 = P/n + P×r_month → P = 월상환 / (1/n + r_month)
 */
export function dsrLoanCapacityEqualPrincipal(
  annualRepayCapacity: number,
  assessmentRate: number,
  years = 30,
): number {
  if (annualRepayCapacity <= 0) return 0;
  const months = years * 12;
  const monthly = annualRepayCapacity / 12;
  const rMonth = assessmentRate / 12;
  if (months <= 0) return 0;
  return monthly / (1 / months + rMonth);
}

/**
 * 연소득·DSR비율·기존 연간원리금으로 신규대출에 쓸 수 있는 연간 상환액.
 */
export function dsrAnnualRepayCapacity(
  annualIncome: number,
  dsrRate: number,
  existingAnnualDebt = 0,
): number {
  return Math.max(0, annualIncome * dsrRate - Math.max(0, existingAnnualDebt));
}

/**
 * @deprecated dsrLoanCapacityEqualPayment 사용.
 * 연금현재가치 공식으로 DSR 기준 최대 대출원금을 산정합니다.
 */
export function dsrLoanCapacity(
  annualIncome: number,
  dsrRate: number,
  rate: number,
  years = 30,
): number {
  return dsrLoanCapacityEqualPayment(
    dsrAnnualRepayCapacity(annualIncome, dsrRate, 0),
    rate,
    years,
  );
}
